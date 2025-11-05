/**
 * ReceiveMessage Component
 * 
 * Officer 2:
 * - Sees list of encrypted messages
 * - Enters their current location
 * - Tries to decrypt
 * - SUCCESS if at correct location, FAIL if wrong location
 */

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
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

interface ReceiveMessageProps {
  serverUrl: string;
}

interface Message {
  id: string;
  senderName: string;
  encrypted: string;
  targetLat: number;
  targetLon: number;
  radiusMeters: number;
  timestamp: number;
}

function LocationPicker({ onLocationSelect }: { onLocationSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function ReceiveMessage({ serverUrl }: ReceiveMessageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [currentLat, setCurrentLat] = useState(19.0760); // Default: Mumbai
  const [currentLon, setCurrentLon] = useState(72.8777);
  const [useGPS, setUseGPS] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load messages on mount
  useEffect(() => {
    loadMessages();
  }, []);

  // Get GPS location
  useEffect(() => {
    if (useGPS && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLat(position.coords.latitude);
          setCurrentLon(position.coords.longitude);
        },
        (error) => {
          console.error('GPS error:', error);
          alert('Failed to get GPS location');
          setUseGPS(false);
        }
      );
    }
  }, [useGPS]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/messages`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Load messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (lat: number, lon: number) => {
    setCurrentLat(lat);
    setCurrentLon(lon);
  };

  const handleDecrypt = async () => {
    if (!selectedMessage) {
      alert('Please select a message');
      return;
    }

    setDecrypting(true);
    setResult(null);

    try {
      const response = await fetch(`${serverUrl}/api/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: selectedMessage.id,
          currentLat,
          currentLon,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Decrypt error:', error);
      setResult({ success: false, error: 'Network error - is the server running?' });
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-terminal-accent font-bold">AVAILABLE MESSAGES:</label>
          <button
            onClick={loadMessages}
            className="terminal-button-secondary px-3 py-1 text-sm"
          >
            🔄 REFRESH
          </button>
        </div>

        {loading ? (
          <div className="text-terminal-text-secondary text-center py-4">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="border-2 border-terminal-border bg-black p-4 text-center text-terminal-text-secondary">
            No messages available. Ask Officer 1 to send a message first.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => setSelectedMessage(msg)}
                className={`w-full text-left border-2 p-3 transition-colors ${
                  selectedMessage?.id === msg.id
                    ? 'border-terminal-accent bg-terminal-accent bg-opacity-20'
                    : 'border-terminal-border bg-black hover:border-terminal-accent'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-terminal-text font-bold">From: {msg.senderName}</p>
                    <p className="text-terminal-text-secondary text-sm mt-1">
                      Location: ({msg.targetLat.toFixed(4)}, {msg.targetLon.toFixed(4)})
                    </p>
                    <p className="text-terminal-text-secondary text-sm">
                      Radius: {msg.radiusMeters}m
                    </p>
                  </div>
                  <div className="text-xs text-terminal-text-secondary">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <p className="text-xs text-terminal-warning mt-2 font-mono break-all">
                  🔒 {msg.encrypted.substring(0, 50)}...
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current Location */}
      {selectedMessage && (
        <>
          <div className="border-t-2 border-terminal-border pt-6">
            <label className="block text-terminal-accent mb-2 font-bold">YOUR CURRENT LOCATION:</label>
            
            {/* GPS Toggle */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setUseGPS(!useGPS)}
                className={`terminal-button-secondary px-4 py-2 ${
                  useGPS ? 'border-terminal-success' : ''
                }`}
              >
                {useGPS ? '✓ GPS ACTIVE' : '📍 USE GPS'}
              </button>
              <span className="text-terminal-text-secondary text-sm">
                Or click on map / enter manually
              </span>
            </div>

            {/* Manual Coordinates */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-terminal-text-secondary">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={currentLat}
                  onChange={(e) => setCurrentLat(parseFloat(e.target.value))}
                  className="w-full bg-black border-2 border-terminal-border px-3 py-2 text-terminal-text focus:border-terminal-accent outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-terminal-text-secondary">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={currentLon}
                  onChange={(e) => setCurrentLon(parseFloat(e.target.value))}
                  className="w-full bg-black border-2 border-terminal-border px-3 py-2 text-terminal-text focus:border-terminal-accent outline-none"
                />
              </div>
            </div>

            {/* Map showing both locations */}
            <div className="border-2 border-terminal-border h-[350px] relative">
              <MapContainer
                center={[selectedMessage.targetLat, selectedMessage.targetLon]}
                zoom={13}
                className="h-full w-full"
                key={`${selectedMessage.id}-${currentLat}-${currentLon}`}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                
                {/* Target location (red) */}
                <Circle
                  center={[selectedMessage.targetLat, selectedMessage.targetLon]}
                  radius={selectedMessage.radiusMeters}
                  pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
                />
                <Marker position={[selectedMessage.targetLat, selectedMessage.targetLon]} />
                
                {/* Current location (blue) */}
                <Marker
                  position={[currentLat, currentLon]}
                  icon={L.icon({
                    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDYuOSAxMi41IDI4LjUgMTIuNSAyOC41czEyLjUtMjEuNiAxMi41LTI4LjVDMjUgNS42IDE5LjQgMCAxMi41IDB6IiBmaWxsPSIjMDA3YmZmIi8+PGNpcmNsZSBjeD0iMTIuNSIgY3k9IjEyLjUiIHI9IjUiIGZpbGw9IiNmZmYiLz48L3N2Zz4=',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                  })}
                />
                
                <LocationPicker onLocationSelect={handleMapClick} />
              </MapContainer>
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-90 px-3 py-2 text-xs z-[1000] border border-terminal-border space-y-1">
                <div className="text-terminal-error">🔴 Target Location (where you need to be)</div>
                <div className="text-terminal-info">🔵 Your Current Location</div>
              </div>
            </div>
          </div>

          {/* Decrypt Button */}
          <button
            onClick={handleDecrypt}
            disabled={decrypting}
            className="terminal-button w-full py-3 text-lg font-bold"
          >
            {decrypting ? 'ATTEMPTING DECRYPTION...' : '🔓 TRY TO DECRYPT MESSAGE'}
          </button>

          {/* Result */}
          {result && (
            <div className={`border-2 p-4 ${
              result.success 
                ? 'border-terminal-success bg-terminal-success bg-opacity-10' 
                : 'border-terminal-error bg-terminal-error bg-opacity-10'
            }`}>
              {result.success ? (
                <div className="space-y-3">
                  <p className="text-terminal-success font-bold text-xl">✓ DECRYPTION SUCCESSFUL!</p>
                  <div className="bg-black border-2 border-terminal-success p-4">
                    <p className="text-terminal-accent text-sm mb-2">FROM: {result.senderName}</p>
                    <p className="text-terminal-text text-lg">{result.message}</p>
                  </div>
                  <p className="text-terminal-text-secondary text-sm">
                    You were {result.distance}m from target location
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-terminal-error font-bold text-xl">✗ DECRYPTION FAILED</p>
                  <p className="text-terminal-text">You're too far from the target location!</p>
                  <div className="bg-black border border-terminal-error p-3 text-sm">
                    <p className="text-terminal-text-secondary">
                      Distance from target: <span className="text-terminal-error font-bold">{result.distance}m</span>
                    </p>
                    <p className="text-terminal-text-secondary">
                      Required: <span className="text-terminal-success font-bold">{result.required}m</span>
                    </p>
                    <p className="text-terminal-warning mt-2">
                      Move closer to the red target area and try again!
                    </p>
                  </div>
                  {result.encrypted && (
                    <div className="mt-3">
                      <p className="text-terminal-text-secondary text-sm mb-1">Encrypted message (gibberish):</p>
                      <p className="text-terminal-warning text-xs font-mono break-all bg-black p-2 border border-terminal-border">
                        {result.encrypted}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
