import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { LatLng } from 'leaflet';
import { useNavigate } from 'react-router-dom';
import * as crypto from '../lib/crypto';
import 'leaflet/dist/leaflet.css';

// Fix leaflet icon issue
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapClickHandler({ onClick }: { onClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng);
    },
  });
  return null;
}

const ComposeMessage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'compose' | 'location' | 'encrypt' | 'done'>('compose');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number }>({ lat: 18.5204, lon: 73.8567 });
  const [radius, setRadius] = useState(100);
  const [windowHours, setWindowHours] = useState(24);
  const [recipientPublicKey, setRecipientPublicKey] = useState('');
  const [encrypting, setEncrypting] = useState(false);
  const [messageId, setMessageId] = useState('');
  const [showExplain, setShowExplain] = useState(false);

  const handleMapClick = (latlng: LatLng) => {
    setCoordinates({ lat: latlng.lat, lon: latlng.lng });
  };

  const handleEncrypt = async () => {
    try {
      setEncrypting(true);
      setStep('encrypt');

      // Generate ephemeral sender key pair
      const senderKeys = crypto.generateX25519KeyPair();
      
      // Compute shared secret
      const sharedSecret = crypto.computeSharedSecret(senderKeys.privateKey, recipientPublicKey);
      
      // Generate message encryption key
      const messageKey = crypto.generateAesKey();
      
      // Encrypt message with K_msg
      const { ciphertext, nonce: payloadNonce, authTag: payloadAuthTag } = 
        await crypto.aesGcmEncrypt(message, messageKey);
      
      // Derive location-bound key
      const now = Date.now();
      const windowStart = now;
      const windowEnd = now + (windowHours * 60 * 60 * 1000);
      const keyNonce = crypto.generateNonce();
      
      const locationBoundKey = await crypto.deriveLocationBoundKey(
        sharedSecret,
        coordinates.lat,
        coordinates.lon,
        radius,
        windowStart,
        windowEnd,
        keyNonce
      );
      
      // Wrap K_msg with location-bound key
      const { wrappedKey, nonce: wrappedKeyNonce, authTag: wrappedKeyAuthTag } = 
        await crypto.wrapKey(messageKey, locationBoundKey);
      
      // Store message on backend
      const storedMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        senderPublicKey: senderKeys.publicKey,
        recipientPublicKey,
        encryptedPayload: ciphertext,
        payloadNonce,
        payloadAuthTag,
        wrappedKey,
        wrappedKeyNonce,
        wrappedKeyAuthTag,
        locationBinding: {
          latitude: coordinates.lat,
          longitude: coordinates.lon,
          radiusMeters: radius,
          windowStart,
          windowEnd,
          nonce: keyNonce,
        },
        metadata: {
          title: title || 'Untitled Message',
          created: now,
          expiresAt: windowEnd,
        },
      };
      
      // Send to backend
      const response = await fetch('http://localhost:3001/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storedMessage),
      });
      
      const result = await response.json();
      setMessageId(result.messageId);
      setStep('done');
    } catch (error) {
      console.error('Encryption failed:', error);
      alert('Encryption failed: ' + (error as Error).message);
    } finally {
      setEncrypting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="terminal-window">
        <div className="terminal-header">
          <span className="terminal-title">Compose Location-Bound Message</span>
          <button 
            onClick={() => setShowExplain(!showExplain)}
            className="terminal-button-secondary px-2 py-1 text-xs"
          >
            {showExplain ? 'HIDE' : 'EXPLAIN'}
          </button>
        </div>

        {showExplain && (
          <div className="bg-terminal-bg-tertiary border-b border-terminal-border p-4 text-sm space-y-2">
            <h3 className="text-terminal-accent font-bold">How Location-Bound Encryption Works:</h3>
            <ol className="list-decimal list-inside space-y-1 text-terminal-text-secondary">
              <li>You and recipient exchange public keys (X25519 Diffie-Hellman)</li>
              <li>Both compute shared secret: <code>S = DH(your_private, their_public)</code></li>
              <li>Derive location key: <code>K_loc = HKDF(S || lat || lon || radius || time)</code></li>
              <li>Encrypt message: <code>C = AES-GCM(message, K_msg)</code></li>
              <li>Wrap message key: <code>wrapped = AES-GCM(K_msg, K_loc)</code></li>
              <li>Recipient must be at location to derive same K_loc and unwrap K_msg</li>
            </ol>
            <div className="mt-2 text-terminal-warning text-xs">
              ⚠ The coordinates become part of the key. Wrong location = wrong key = no decryption.
            </div>
          </div>
        )}

        <div className="terminal-body">
          {step === 'compose' && (
            <div className="space-y-4">
              <div>
                <label className="block text-terminal-accent mb-2">MESSAGE TITLE</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="terminal-input w-full"
                  placeholder="Secret Drop"
                />
              </div>

              <div>
                <label className="block text-terminal-accent mb-2">MESSAGE CONTENT</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="terminal-input w-full h-32"
                  placeholder="Enter your secret message..."
                />
              </div>

              <div>
                <label className="block text-terminal-accent mb-2">RECIPIENT PUBLIC KEY (X25519)</label>
                <input
                  type="text"
                  value={recipientPublicKey}
                  onChange={(e) => setRecipientPublicKey(e.target.value)}
                  className="terminal-input w-full font-mono text-xs"
                  placeholder="Base64 encoded X25519 public key"
                />
                <div className="mt-2 text-xs text-terminal-dim">
                  For demo: Generate a key pair in browser console:
                  <code className="block mt-1 bg-terminal-bg p-1">
                    nacl.box.keyPair()
                  </code>
                </div>
              </div>

              <button
                onClick={() => setStep('location')}
                className="terminal-button w-full"
                disabled={!message || !recipientPublicKey}
              >
                NEXT: SET LOCATION
              </button>
            </div>
          )}

          {step === 'location' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-terminal-accent mb-2">LATITUDE</label>
                  <input
                    type="number"
                    value={coordinates.lat}
                    onChange={(e) => setCoordinates({ ...coordinates, lat: parseFloat(e.target.value) })}
                    className="terminal-input w-full"
                    step="0.000001"
                  />
                </div>
                <div>
                  <label className="block text-terminal-accent mb-2">LONGITUDE</label>
                  <input
                    type="number"
                    value={coordinates.lon}
                    onChange={(e) => setCoordinates({ ...coordinates, lon: parseFloat(e.target.value) })}
                    className="terminal-input w-full"
                    step="0.000001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-terminal-accent mb-2">RADIUS (meters): {radius}m</label>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-terminal-accent mb-2">TIME WINDOW (hours): {windowHours}h</label>
                <input
                  type="range"
                  min="1"
                  max="168"
                  value={windowHours}
                  onChange={(e) => setWindowHours(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="h-64 border border-terminal-border rounded overflow-hidden">
                <MapContainer
                  center={[coordinates.lat, coordinates.lon]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <Marker position={[coordinates.lat, coordinates.lon]} />
                  <Circle
                    center={[coordinates.lat, coordinates.lon]}
                    radius={radius}
                    pathOptions={{ color: '#00ff00', fillColor: '#00ff00', fillOpacity: 0.2 }}
                  />
                  <MapClickHandler onClick={handleMapClick} />
                </MapContainer>
              </div>

              <div className="flex space-x-4">
                <button onClick={() => setStep('compose')} className="terminal-button-secondary flex-1">
                  BACK
                </button>
                <button onClick={handleEncrypt} className="terminal-button flex-1">
                  ENCRYPT & STORE
                </button>
              </div>
            </div>
          )}

          {step === 'encrypt' && (
            <div className="text-center py-12">
              <div className="text-terminal-accent text-xl mb-4 animate-pulse">
                ENCRYPTING MESSAGE...
              </div>
              <div className="space-y-2 text-sm text-terminal-text-secondary">
                <div>✓ Generating ephemeral keys</div>
                <div>✓ Computing shared secret</div>
                <div>✓ Deriving location-bound key</div>
                <div>✓ Encrypting payload</div>
                <div>✓ Wrapping message key</div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-12">
              <div className="text-terminal-success text-2xl mb-4">
                ✓ MESSAGE ENCRYPTED
              </div>
              <div className="terminal-card max-w-md mx-auto text-left space-y-2">
                <div className="text-terminal-accent">Message ID:</div>
                <div className="font-mono text-xs break-all">{messageId}</div>
                <div className="terminal-divider" />
                <div className="text-terminal-text-secondary text-sm">
                  Message can only be decrypted at:
                </div>
                <div className="font-mono text-xs">
                  {coordinates.lat.toFixed(6)}°N, {coordinates.lon.toFixed(6)}°E
                </div>
                <div className="font-mono text-xs">
                  Radius: {radius}m | Window: {windowHours}h
                </div>
              </div>
              <button
                onClick={() => navigate('/messages')}
                className="terminal-button mt-6"
              >
                VIEW MESSAGES
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComposeMessage;
