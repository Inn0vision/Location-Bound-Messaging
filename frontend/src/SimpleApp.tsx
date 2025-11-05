/**
 * SIMPLIFIED Frontend for Location-Bound Messaging
 * 
 * Two simple views:
 * 1. SEND MESSAGE - Officer 1 enters message + picks location on map
 * 2. RECEIVE MESSAGE - Officer 2 tries to decrypt at their location
 */

import { useState } from 'react';
import SendMessage from './components/SendMessage';
import ReceiveMessage from './components/ReceiveMessage';
import './index.css';

type View = 'send' | 'receive';

function App() {
  const [view, setView] = useState<View>('send');
  
  // Auto-detect server URL based on current host
  // If accessing via IP (e.g., 192.168.1.50:5173), use that IP for backend
  // If accessing via localhost, use localhost for backend
  const getServerUrl = () => {
    if (import.meta.env.VITE_SERVER_URL) {
      return import.meta.env.VITE_SERVER_URL;
    }
    
    // Use the same host as the frontend, but port 3001
    const currentHost = window.location.hostname;
    return `http://${currentHost}:3001`;
  };
  
  const [serverUrl] = useState(getServerUrl());

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text scanlines">
      {/* Header */}
      <header className="border-b-2 border-terminal-border bg-terminal-bg-secondary">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-glow tracking-wider">
                LOCATION-BOUND MESSAGING
              </h1>
              <p className="text-terminal-text-secondary text-sm mt-1">
                Messages that only decrypt at the right location
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setView('send')}
                className={`terminal-button px-6 py-2 ${
                  view === 'send' ? 'bg-terminal-accent' : 'bg-terminal-bg-secondary'
                }`}
              >
                SEND MESSAGE
              </button>
              <button
                onClick={() => setView('receive')}
                className={`terminal-button px-6 py-2 ${
                  view === 'receive' ? 'bg-terminal-accent' : 'bg-terminal-bg-secondary'
                }`}
              >
                RECEIVE MESSAGE
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="terminal-window">
          <div className="terminal-header">
            <span className="terminal-title">
              {view === 'send' ? '📤 SEND ENCRYPTED MESSAGE' : '📥 RECEIVE & DECRYPT MESSAGE'}
            </span>
          </div>
          <div className="terminal-body">
            {view === 'send' ? (
              <SendMessage serverUrl={serverUrl} />
            ) : (
              <ReceiveMessage serverUrl={serverUrl} />
            )}
          </div>
        </div>

        {/* Explanation Panel */}
        <div className="mt-8 terminal-window">
          <div className="terminal-header">
            <span className="terminal-title">💡 HOW IT WORKS</span>
          </div>
          <div className="terminal-body">
            <div className="space-y-4 text-terminal-text-secondary">
              <div className="flex gap-4">
                <div className="text-terminal-accent font-bold min-w-[30px]">1.</div>
                <div>
                  <strong className="text-terminal-text">Officer 1 (Sender):</strong> Enters message and picks destination location on map
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="text-terminal-accent font-bold min-w-[30px]">2.</div>
                <div>
                  <strong className="text-terminal-text">SHA-256 Hashing:</strong> Creates encryption key from lat/long coordinates
                  <br />
                  <code className="text-xs bg-black px-2 py-1 rounded">
                    key = SHA256(latitude + longitude)
                  </code>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="text-terminal-accent font-bold min-w-[30px]">3.</div>
                <div>
                  <strong className="text-terminal-text">XOR Encryption:</strong> Message encrypted with location-based key
                  <br />
                  <code className="text-xs bg-black px-2 py-1 rounded">
                    encrypted = message XOR key
                  </code>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="text-terminal-accent font-bold min-w-[30px]">4.</div>
                <div>
                  <strong className="text-terminal-text">Officer 2 (Receiver):</strong> Tries to decrypt at their current location
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="text-terminal-accent font-bold min-w-[30px]">5.</div>
                <div>
                  <strong className="text-terminal-success">✓ Correct Location:</strong> SHA-256 recreates the same key → message decrypts successfully!
                  <br />
                  <strong className="text-terminal-error">✗ Wrong Location:</strong> Different key → message stays encrypted (gibberish)
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-terminal-border bg-terminal-bg-secondary mt-12">
        <div className="container mx-auto px-4 py-3 text-center text-terminal-text-secondary text-sm">
          <p>Server: {serverUrl} | Crypto: SHA-256 + XOR | Demo System</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
