/**
 * Location-Bound Messaging Backend Server
 * 
 * Provides:
 * - REST API for message storage and retrieval
 * - WebSocket signaling for WebRTC P2P connections
 * - Location attestation verification
 * - mDNS discovery for LAN peers
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import {
  verifyLocationAttestation,
  type LocationAttestation,
  type VerificationConfig,
  formatCoordinates,
  formatDistance,
} from './location.js';
import { deriveLocationBoundKey, unwrapKey } from './crypto.js';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '3001');
const WS_PORT = parseInt(process.env.WS_PORT || '3002');

// ============================================================================
// Types
// ============================================================================

interface StoredMessage {
  id: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  encryptedPayload: string; // Base64 encoded ciphertext
  payloadNonce: string;
  payloadAuthTag: string;
  wrappedKey: string; // K_msg wrapped with K_loc_input
  wrappedKeyNonce: string;
  wrappedKeyAuthTag: string;
  locationBinding: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    windowStart: number;
    windowEnd: number;
    nonce: string; // Used in key derivation
  };
  metadata: {
    title?: string;
    created: number;
    expiresAt?: number;
  };
}

interface UnlockRequest {
  messageId: string;
  attestation: LocationAttestation;
  recipientPrivateKey: string; // Ephemeral DH private key
}

// ============================================================================
// In-Memory Storage (for demo - use database in production)
// ============================================================================

const messages = new Map<string, StoredMessage>();
const peers = new Set<WebSocket>();

// ============================================================================
// Express REST API
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'location-bound-messaging',
    timestamp: Date.now(),
    messagesStored: messages.size,
    peersConnected: peers.size,
  });
});

// Store a new message
app.post('/api/messages', (req, res) => {
  try {
    const message: StoredMessage = req.body;
    
    // Validation
    if (!message.id || !message.encryptedPayload || !message.wrappedKey) {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    
    if (!message.locationBinding) {
      return res.status(400).json({ error: 'Missing location binding' });
    }
    
    // Store message (ciphertext only - no plaintext!)
    messages.set(message.id, message);
    
    console.log(`[MSG] Stored message ${message.id} bound to ${formatCoordinates(
      message.locationBinding.latitude,
      message.locationBinding.longitude
    )}`);
    
    res.json({
      success: true,
      messageId: message.id,
      expiresAt: message.metadata.expiresAt,
    });
  } catch (error) {
    console.error('[ERROR] Failed to store message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get message metadata (without decryption)
app.get('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  const message = messages.get(id);
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  // Check expiration
  if (message.metadata.expiresAt && Date.now() > message.metadata.expiresAt) {
    messages.delete(id);
    return res.status(410).json({ error: 'Message expired' });
  }
  
  // Return metadata only (no keys or plaintext)
  res.json({
    id: message.id,
    locationBinding: message.locationBinding,
    metadata: message.metadata,
    senderPublicKey: message.senderPublicKey,
    recipientPublicKey: message.recipientPublicKey,
  });
});

// Get encrypted message (full ciphertext for client-side decryption)
app.get('/api/messages/:id/encrypted', (req, res) => {
  const { id } = req.params;
  const message = messages.get(id);
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  // Check expiration
  if (message.metadata.expiresAt && Date.now() > message.metadata.expiresAt) {
    messages.delete(id);
    return res.status(410).json({ error: 'Message expired' });
  }
  
  // Return full encrypted message for client-side decryption
  res.json(message);
});

// Unlock message with location attestation (server-side verification)
app.post('/api/messages/:id/unlock', async (req, res) => {
  try {
    const { id } = req.params;
    const unlockReq: UnlockRequest = req.body;
    
    const message = messages.get(id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Check expiration
    if (message.metadata.expiresAt && Date.now() > message.metadata.expiresAt) {
      messages.delete(id);
      return res.status(410).json({ error: 'Message expired' });
    }
    
    // Verify location attestation
    const verificationConfig: VerificationConfig = {
      targetLat: message.locationBinding.latitude,
      targetLon: message.locationBinding.longitude,
      radiusMeters: message.locationBinding.radiusMeters,
      windowStart: message.locationBinding.windowStart,
      windowEnd: message.locationBinding.windowEnd,
      maxAttestationAgeSec: 300, // 5 minutes
    };
    
    const verification = verifyLocationAttestation(
      unlockReq.attestation,
      verificationConfig
    );
    
    if (!verification.valid) {
      console.log(`[UNLOCK] Failed for ${id}: ${verification.reason}`);
      return res.status(403).json({
        unlocked: false,
        reason: verification.reason,
        distance: verification.distance,
      });
    }
    
    console.log(`[UNLOCK] Success for ${id} at distance ${formatDistance(verification.distance!)}`);
    
    // Return wrapped key for client to unwrap (don't unwrap server-side!)
    // Client will compute shared secret and derive K_loc_input locally
    res.json({
      unlocked: true,
      wrappedKey: message.wrappedKey,
      wrappedKeyNonce: message.wrappedKeyNonce,
      wrappedKeyAuthTag: message.wrappedKeyAuthTag,
      distance: verification.distance,
    });
  } catch (error) {
    console.error('[ERROR] Unlock failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List messages (for demo/debug)
app.get('/api/messages', (req, res) => {
  const messageList = Array.from(messages.values()).map(msg => ({
    id: msg.id,
    title: msg.metadata.title,
    location: formatCoordinates(
      msg.locationBinding.latitude,
      msg.locationBinding.longitude
    ),
    radius: msg.locationBinding.radiusMeters,
    created: msg.metadata.created,
    expiresAt: msg.metadata.expiresAt,
  }));
  
  res.json({ messages: messageList, count: messageList.length });
});

// Delete message
app.delete('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  const deleted = messages.delete(id);
  
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

// ============================================================================
// WebSocket Signaling Server (for WebRTC P2P)
// ============================================================================

const httpServer = createServer(app);
const wss = new WebSocketServer({ port: WS_PORT });

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-list' | 'register' | 'heartbeat';
  from?: string;
  to?: string;
  data?: any;
  peers?: string[];
}

const connectedPeers = new Map<string, WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  let peerId: string | null = null;
  
  console.log('[WS] New WebSocket connection');
  peers.add(ws);
  
  ws.on('message', (data: Buffer) => {
    try {
      const message: SignalingMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'register':
          // Register peer with ID
          peerId = message.from || `peer-${Date.now()}`;
          connectedPeers.set(peerId, ws);
          console.log(`[WS] Peer registered: ${peerId}`);
          
          // Send peer list
          ws.send(JSON.stringify({
            type: 'peer-list',
            peers: Array.from(connectedPeers.keys()).filter(id => id !== peerId),
          }));
          break;
          
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Forward signaling message to recipient
          if (message.to) {
            const recipientWs = connectedPeers.get(message.to);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify(message));
              console.log(`[WS] Forwarded ${message.type} from ${message.from} to ${message.to}`);
            }
          } else {
            // Broadcast to all peers
            peers.forEach(peer => {
              if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                peer.send(JSON.stringify(message));
              }
            });
          }
          break;
          
        case 'heartbeat':
          // Respond to heartbeat
          ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
          break;
      }
    } catch (error) {
      console.error('[WS] Error handling message:', error);
    }
  });
  
  ws.on('close', () => {
    if (peerId) {
      connectedPeers.delete(peerId);
      console.log(`[WS] Peer disconnected: ${peerId}`);
    }
    peers.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('[WS] WebSocket error:', error);
  });
});

// ============================================================================
// mDNS Service Discovery (for LAN)
// ============================================================================

async function startMdnsDiscovery() {
  try {
    const mdns = await import('multicast-dns');
    const mdnsServer = mdns.default();
    
    const serviceName = process.env.MDNS_SERVICE_NAME || 'locmsg';
    const serviceType = process.env.MDNS_SERVICE_TYPE || 'http';
    
    mdnsServer.on('query', (query) => {
      // Respond to service discovery queries
      query.questions.forEach((q) => {
        if (q.name === `${serviceName}.${serviceType}.local`) {
          mdnsServer.respond({
            answers: [
              {
                name: `${serviceName}.${serviceType}.local`,
                type: 'A',
                ttl: 300,
                data: '0.0.0.0', // Bind to all interfaces
              },
              {
                name: `${serviceName}.${serviceType}.local`,
                type: 'SRV',
                ttl: 300,
                data: {
                  port: PORT,
                  weight: 0,
                  priority: 10,
                  target: `${serviceName}.local`,
                },
              },
            ],
          });
        }
      });
    });
    
    console.log(`[MDNS] Service advertised as ${serviceName}.${serviceType}.local`);
  } catch (error) {
    console.warn('[MDNS] Failed to start mDNS discovery:', error);
    console.warn('[MDNS] Continuing without service discovery');
  }
}

// ============================================================================
// Server Startup
// ============================================================================

httpServer.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  LOCATION-BOUND MESSAGING SYSTEM');
  console.log('  Backend Server');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  HTTP API:       http://localhost:${PORT}`);
  console.log(`  WebSocket:      ws://localhost:${WS_PORT}`);
  console.log(`  Environment:    ${process.env.NODE_ENV || 'development'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Start mDNS discovery
  startMdnsDiscovery();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('[SERVER] HTTP server closed');
    wss.close(() => {
      console.log('[SERVER] WebSocket server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('[SERVER] HTTP server closed');
    wss.close(() => {
      console.log('[SERVER] WebSocket server closed');
      process.exit(0);
    });
  });
});

export { app, httpServer, wss };
