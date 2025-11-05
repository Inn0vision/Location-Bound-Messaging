import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import * as crypto from '../lib/crypto';

interface StoredMessage {
  id: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  encryptedPayload: string;
  payloadNonce: string;
  payloadAuthTag: string;
  wrappedKey: string;
  wrappedKeyNonce: string;
  wrappedKeyAuthTag: string;
  locationBinding: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    windowStart: number;
    windowEnd: number;
    nonce: string;
  };
  metadata: {
    title?: string;
    created: number;
    expiresAt?: number;
  };
}

const MessageViewer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState<StoredMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Mock location (in production, use Geolocation API)
  const [userLat, setUserLat] = useState(18.5204);
  const [userLon, setUserLon] = useState(73.8567);
  const [recipientPrivateKey, setRecipientPrivateKey] = useState('');

  useEffect(() => {
    fetchMessage();
  }, [id]);

  const fetchMessage = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/messages/${id}/encrypted`);
      const data = await response.json();
      setMessage(data);
    } catch (error) {
      setError('Failed to fetch message');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  };

  const handleUnlock = async () => {
    if (!message || !recipientPrivateKey) return;

    try {
      setUnlocking(true);
      setError(null);

      // Check distance
      const distance = calculateDistance(
        userLat,
        userLon,
        message.locationBinding.latitude,
        message.locationBinding.longitude
      );

      if (distance > message.locationBinding.radiusMeters) {
        setError(`Too far from target: ${distance.toFixed(0)}m (max: ${message.locationBinding.radiusMeters}m)`);
        return;
      }

      // Compute shared secret
      const sharedSecret = crypto.computeSharedSecret(
        recipientPrivateKey,
        message.senderPublicKey
      );

      // Derive location-bound key
      const locationBoundKey = await crypto.deriveLocationBoundKey(
        sharedSecret,
        message.locationBinding.latitude,
        message.locationBinding.longitude,
        message.locationBinding.radiusMeters,
        message.locationBinding.windowStart,
        message.locationBinding.windowEnd,
        message.locationBinding.nonce
      );

      // Unwrap message key
      const messageKey = await crypto.unwrapKey(
        message.wrappedKey,
        locationBoundKey,
        message.wrappedKeyNonce,
        message.wrappedKeyAuthTag
      );

      // Decrypt message
      const plaintext = await crypto.aesGcmDecrypt(
        message.encryptedPayload,
        messageKey,
        message.payloadNonce,
        message.payloadAuthTag
      );

      setDecrypted(plaintext);
    } catch (error) {
      console.error('Decryption failed:', error);
      setError('Decryption failed: ' + (error as Error).message);
    } finally {
      setUnlocking(false);
    }
  };

  const getStatus = () => {
    if (!message) return { text: 'UNKNOWN', color: 'text-terminal-dim' };
    
    const now = Date.now();
    if (now < message.locationBinding.windowStart) {
      return { text: 'NOT YET ACTIVE', color: 'text-terminal-warning' };
    }
    if (now > message.locationBinding.windowEnd) {
      return { text: 'EXPIRED', color: 'text-terminal-error' };
    }
    
    const distance = calculateDistance(
      userLat,
      userLon,
      message.locationBinding.latitude,
      message.locationBinding.longitude
    );
    
    if (distance <= message.locationBinding.radiusMeters) {
      return { text: 'UNLOCKABLE', color: 'text-terminal-success' };
    }
    
    return { text: `LOCKED (${distance.toFixed(0)}m away)`, color: 'text-terminal-error' };
  };

  if (loading) {
    return (
      <div className="terminal-window max-w-6xl mx-auto">
        <div className="terminal-body text-center py-12 text-terminal-accent animate-pulse">
          LOADING MESSAGE...
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="terminal-window max-w-6xl mx-auto">
        <div className="terminal-body text-center py-12">
          <div className="text-terminal-error mb-4">MESSAGE NOT FOUND</div>
          <button onClick={() => navigate('/messages')} className="terminal-button">
            BACK TO MESSAGES
          </button>
        </div>
      </div>
    );
  }

  const status = getStatus();

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="terminal-window">
        <div className="terminal-header">
          <span className="terminal-title">{message.metadata.title}</span>
          <span className={`terminal-badge ${status.color}`}>{status.text}</span>
        </div>

        <div className="terminal-body">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="terminal-card">
              <div className="text-terminal-accent mb-2">TARGET LOCATION</div>
              <div className="font-mono text-sm">
                {message.locationBinding.latitude.toFixed(6)}°N, {message.locationBinding.longitude.toFixed(6)}°E
              </div>
              <div className="text-terminal-dim text-sm mt-1">
                Radius: {message.locationBinding.radiusMeters}m
              </div>
            </div>

            <div className="terminal-card">
              <div className="text-terminal-accent mb-2">TIME WINDOW</div>
              <div className="text-sm">
                Start: {new Date(message.locationBinding.windowStart).toLocaleString()}
              </div>
              <div className="text-sm">
                End: {new Date(message.locationBinding.windowEnd).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="h-64 border border-terminal-border rounded overflow-hidden mb-4">
            <MapContainer
              center={[message.locationBinding.latitude, message.locationBinding.longitude]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              <Marker position={[message.locationBinding.latitude, message.locationBinding.longitude]} />
              <Circle
                center={[message.locationBinding.latitude, message.locationBinding.longitude]}
                radius={message.locationBinding.radiusMeters}
                pathOptions={{ color: '#00ff00', fillColor: '#00ff00', fillOpacity: 0.2 }}
              />
              <Marker position={[userLat, userLon]} />
            </MapContainer>
          </div>

          {!decrypted && (
            <div className="space-y-4">
              <div>
                <label className="block text-terminal-accent mb-2">YOUR LOCATION (for demo - use GPS in production)</label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    value={userLat}
                    onChange={(e) => setUserLat(parseFloat(e.target.value))}
                    className="terminal-input"
                    step="0.000001"
                    placeholder="Latitude"
                  />
                  <input
                    type="number"
                    value={userLon}
                    onChange={(e) => setUserLon(parseFloat(e.target.value))}
                    className="terminal-input"
                    step="0.000001"
                    placeholder="Longitude"
                  />
                </div>
              </div>

              <div>
                <label className="block text-terminal-accent mb-2">YOUR PRIVATE KEY (X25519)</label>
                <input
                  type="text"
                  value={recipientPrivateKey}
                  onChange={(e) => setRecipientPrivateKey(e.target.value)}
                  className="terminal-input w-full font-mono text-xs"
                  placeholder="Base64 encoded X25519 private key"
                />
              </div>

              {error && (
                <div className="terminal-card border-terminal-error">
                  <div className="text-terminal-error">{error}</div>
                </div>
              )}

              <button
                onClick={handleUnlock}
                className="terminal-button w-full"
                disabled={unlocking || !recipientPrivateKey}
              >
                {unlocking ? 'DECRYPTING...' : 'UNLOCK MESSAGE'}
              </button>
            </div>
          )}

          {decrypted && (
            <div className="space-y-4">
              <div className="terminal-card border-terminal-success">
                <div className="text-terminal-success font-bold mb-2">✓ MESSAGE UNLOCKED</div>
                <div className="bg-terminal-bg p-4 rounded font-mono text-sm whitespace-pre-wrap">
                  {decrypted}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <button onClick={() => navigate('/messages')} className="terminal-button-secondary w-full">
        BACK TO MESSAGES
      </button>
    </div>
  );
};

export default MessageViewer;
