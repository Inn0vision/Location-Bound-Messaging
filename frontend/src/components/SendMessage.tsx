/**
 * SendMessage Component
 * 
 * Officer 1 enters:
 * - Message text
 * - Destination coordinates (pick on map or enter manually)
 * - Sender name
 * 
 * Then sends encrypted message to server
 */

import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface SendMessageProps {
  serverUrl: string;
}

function LocationPicker({ onLocationSelect }: { onLocationSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function SendMessage({ serverUrl }: SendMessageProps) {
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('Officer Alpha');
  const [targetLat, setTargetLat] = useState(19.0760); // Default: Mumbai
  const [targetLon, setTargetLon] = useState(72.8777);
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleMapClick = (lat: number, lon: number) => {
    setTargetLat(lat);
    setTargetLon(lon);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await fetch(`${serverUrl}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          senderName,
          targetLat,
          targetLon,
          radiusMeters,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          messageId: data.messageId,
          encrypted: data.encrypted,
        });
        
        // Reset form
        setMessage('');
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (error) {
      console.error('Send error:', error);
      setResult({ success: false, error: 'Network error - is the server running?' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sender Name */}
      <div>
        <label className="block text-terminal-accent mb-2 font-bold">YOUR NAME:</label>
        <input
          type="text"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          className="w-full bg-black border-2 border-terminal-border px-4 py-2 text-terminal-text focus:border-terminal-accent outline-none"
          placeholder="Officer Alpha"
        />
      </div>

      {/* Message Text */}
      <div>
        <label className="block text-terminal-accent mb-2 font-bold">SECRET MESSAGE:</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-black border-2 border-terminal-border px-4 py-3 text-terminal-text focus:border-terminal-accent outline-none min-h-[120px] resize-none"
          placeholder="Enter your secret message here..."
        />
        <p className="text-terminal-text-secondary text-sm mt-1">
          This message will be encrypted and can only be read at the destination location
        </p>
      </div>

      {/* Destination Location */}
      <div>
        <label className="block text-terminal-accent mb-2 font-bold">DESTINATION LOCATION:</label>
        
        {/* Manual Coordinates */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-terminal-text-secondary">Latitude</label>
            <input
              type="number"
              step="0.0001"
              value={targetLat}
              onChange={(e) => setTargetLat(parseFloat(e.target.value))}
              className="w-full bg-black border-2 border-terminal-border px-3 py-2 text-terminal-text focus:border-terminal-accent outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-terminal-text-secondary">Longitude</label>
            <input
              type="number"
              step="0.0001"
              value={targetLon}
              onChange={(e) => setTargetLon(parseFloat(e.target.value))}
              className="w-full bg-black border-2 border-terminal-border px-3 py-2 text-terminal-text focus:border-terminal-accent outline-none"
            />
          </div>
        </div>

        {/* Map */}
        <div className="border-2 border-terminal-border h-[300px] relative">
          <MapContainer
            center={[targetLat, targetLon]}
            zoom={13}
            className="h-full w-full"
            key={`${targetLat}-${targetLon}`}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Marker position={[targetLat, targetLon]} />
            <LocationPicker onLocationSelect={handleMapClick} />
          </MapContainer>
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-80 px-3 py-2 text-xs text-terminal-text-secondary z-[1000] border border-terminal-border">
            Click on map to set destination
          </div>
        </div>
      </div>

      {/* Radius */}
      <div>
        <label className="block text-terminal-accent mb-2 font-bold">
          UNLOCK RADIUS: {radiusMeters}m
        </label>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          value={radiusMeters}
          onChange={(e) => setRadiusMeters(parseInt(e.target.value))}
          className="w-full"
        />
        <p className="text-terminal-text-secondary text-sm mt-1">
          Receiver must be within {radiusMeters} meters of the destination
        </p>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={sending}
        className="terminal-button w-full py-3 text-lg font-bold"
      >
        {sending ? 'ENCRYPTING & SENDING...' : '🔒 ENCRYPT & SEND MESSAGE'}
      </button>

      {/* Result */}
      {result && (
        <div className={`border-2 p-4 ${
          result.success 
            ? 'border-terminal-success bg-terminal-success bg-opacity-10' 
            : 'border-terminal-error bg-terminal-error bg-opacity-10'
        }`}>
          {result.success ? (
            <div className="space-y-2">
              <p className="text-terminal-success font-bold text-lg">✓ MESSAGE SENT!</p>
              <p className="text-terminal-text-secondary text-sm">
                Message ID: <code className="text-terminal-accent">{result.messageId}</code>
              </p>
              <p className="text-terminal-text-secondary text-sm">
                Encrypted: <code className="text-xs break-all">{result.encrypted.substring(0, 60)}...</code>
              </p>
              <p className="text-terminal-text mt-3">
                Tell Officer 2 to check their messages. They must be at the destination location to decrypt it!
              </p>
            </div>
          ) : (
            <div>
              <p className="text-terminal-error font-bold">✗ SEND FAILED</p>
              <p className="text-terminal-text-secondary text-sm mt-1">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
