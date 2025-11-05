/**
 * SIMPLIFIED Location-Bound Messaging Backend
 * 
 * Easy demo for faculty:
 * 1. Officer 1 sends message with destination location
 * 2. Server stores encrypted message
 * 3. Officer 2 tries to read at their current location
 * 4. If location matches → message decrypts successfully
 * 5. If location wrong → stays encrypted (gibberish)
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { encryptMessage, decryptMessage } from './simple-crypto.js';

const PORT = parseInt(process.env.PORT || '3001');

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  encrypted: string; // base64 encoded ciphertext
  targetLat: number;
  targetLon: number;
  radiusMeters: number;
  senderName: string;
  timestamp: number;
}

// ============================================================================
// In-Memory Storage (simple for demo)
// ============================================================================

const messages = new Map<string, Message>();

// ============================================================================
// Express REST API
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'location-bound-messaging (SIMPLIFIED)',
    messagesStored: messages.size,
    timestamp: Date.now(),
  });
});

/**
 * STEP 1: Officer 1 sends a message
 * 
 * Request:
 * {
 *   "message": "Meet at safehouse tonight",
 *   "senderName": "Officer Alpha",
 *   "targetLat": 19.0760,
 *   "targetLon": 72.8777,
 *   "radiusMeters": 100
 * }
 */
app.post('/api/send', (req, res) => {
  try {
    const { message, senderName, targetLat, targetLon, radiusMeters = 100 } = req.body;
    
    // Validation
    if (!message || !senderName || targetLat === undefined || targetLon === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: message, senderName, targetLat, targetLon'
      });
    }
    
    // Encrypt message bound to location
    const encrypted = encryptMessage(message, targetLat, targetLon, radiusMeters);
    
    // Create message ID
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store message
    const storedMessage: Message = {
      id,
      encrypted: encrypted.encrypted,
      targetLat: encrypted.lat,
      targetLon: encrypted.lon,
      radiusMeters: encrypted.radius,
      senderName,
      timestamp: Date.now(),
    };
    
    messages.set(id, storedMessage);
    
    console.log(`✓ Message sent by ${senderName}`);
    console.log(`  ID: ${id}`);
    console.log(`  Target: (${targetLat.toFixed(4)}, ${targetLon.toFixed(4)})`);
    console.log(`  Radius: ${radiusMeters}m`);
    console.log(`  Original: "${message}"`);
    console.log(`  Encrypted: ${encrypted.encrypted.substring(0, 32)}...`);
    
    res.json({
      success: true,
      messageId: id,
      encrypted: encrypted.encrypted,
      target: {
        lat: targetLat,
        lon: targetLon,
        radius: radiusMeters,
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * STEP 2: Get list of all messages (for Officer 2 to see available messages)
 */
app.get('/api/messages', (req, res) => {
  const messageList = Array.from(messages.values()).map(msg => ({
    id: msg.id,
    senderName: msg.senderName,
    encrypted: msg.encrypted,
    targetLat: msg.targetLat,
    targetLon: msg.targetLon,
    radiusMeters: msg.radiusMeters,
    timestamp: msg.timestamp,
  }));
  
  res.json({
    messages: messageList,
    count: messageList.length,
  });
});

/**
 * STEP 3: Officer 2 tries to decrypt message at their current location
 * 
 * Request:
 * {
 *   "messageId": "msg_...",
 *   "currentLat": 19.0760,
 *   "currentLon": 72.8777
 * }
 * 
 * Response if SUCCESS:
 * {
 *   "success": true,
 *   "message": "Meet at safehouse tonight",
 *   "distance": 15
 * }
 * 
 * Response if WRONG LOCATION:
 * {
 *   "success": false,
 *   "distance": 1250,
 *   "required": 100
 * }
 */
app.post('/api/decrypt', (req, res) => {
  try {
    const { messageId, currentLat, currentLon } = req.body;
    
    // Validation
    if (!messageId || currentLat === undefined || currentLon === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: messageId, currentLat, currentLon'
      });
    }
    
    // Get message
    const message = messages.get(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Try to decrypt at current location
    const result = decryptMessage(
      message.encrypted,
      currentLat,
      currentLon,
      message.targetLat,
      message.targetLon,
      message.radiusMeters
    );
    
    if (result.success) {
      console.log(`✓ Message decrypted successfully!`);
      console.log(`  ID: ${messageId}`);
      console.log(`  Location: (${currentLat.toFixed(4)}, ${currentLon.toFixed(4)})`);
      console.log(`  Distance from target: ${result.distance}m`);
      console.log(`  Decrypted: "${result.message}"`);
      
      return res.json({
        success: true,
        message: result.message,
        distance: result.distance,
        senderName: message.senderName,
      });
    } else {
      console.log(`✗ Decryption failed - wrong location`);
      console.log(`  ID: ${messageId}`);
      console.log(`  Current: (${currentLat.toFixed(4)}, ${currentLon.toFixed(4)})`);
      console.log(`  Target: (${message.targetLat.toFixed(4)}, ${message.targetLon.toFixed(4)})`);
      console.log(`  Distance: ${result.distance}m (required: ${message.radiusMeters}m)`);
      
      return res.json({
        success: false,
        distance: result.distance,
        required: message.radiusMeters,
        encrypted: message.encrypted,
      });
    }
  } catch (error) {
    console.error('Error decrypting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a message
 */
app.delete('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  const deleted = messages.delete(id);
  
  if (deleted) {
    console.log(`✓ Message deleted: ${id}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

// ============================================================================
// Server Startup
// ============================================================================

const httpServer = createServer(app);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  LOCATION-BOUND MESSAGING - SIMPLIFIED DEMO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Server running on: http://localhost:${PORT}`);
  console.log(`  LAN access:        http://<your-ip>:${PORT}`);
  console.log('');
  console.log('  Crypto: SHA-256 + XOR (easy to explain!)');
  console.log('  Ready for faculty demonstration');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('HOW IT WORKS:');
  console.log('1. Officer 1 sends message + destination location');
  console.log('2. SHA-256 creates encryption key from lat/lon coordinates');
  console.log('3. Message encrypted with XOR cipher');
  console.log('4. Officer 2 can ONLY decrypt at the correct location');
  console.log('5. Wrong location = stays encrypted (gibberish)');
  console.log('═══════════════════════════════════════════════════════════════');
});

// Get local IP addresses for faculty access
import { networkInterfaces } from 'os';

setTimeout(() => {
  const nets = networkInterfaces();
  console.log('\nACCESS FROM OTHER DEVICES ON YOUR NETWORK:');
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('');
}, 500);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SERVER] Shutting down gracefully...');
  httpServer.close(() => {
    console.log('[SERVER] Closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[SERVER] Shutting down gracefully...');
  httpServer.close(() => {
    console.log('[SERVER] Closed');
    process.exit(0);
  });
});

export { app, httpServer };
