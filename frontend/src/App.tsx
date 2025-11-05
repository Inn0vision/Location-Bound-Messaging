import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Terminal from './components/Terminal';
import ComposeMessage from './components/ComposeMessage';
import MessageList from './components/MessageList';
import MessageViewer from './components/MessageViewer';

function App() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-terminal-bg text-terminal-text scanlines">
        {/* Header */}
        <header className="border-b border-terminal-border bg-terminal-bg-secondary">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-glow">LOCMSG_TERMINAL</h1>
                <span className="terminal-badge-success">v1.0.0</span>
              </div>
              
              <nav className="flex items-center space-x-4">
                <Link to="/" className="terminal-link">HOME</Link>
                <Link to="/compose" className="terminal-link">COMPOSE</Link>
                <Link to="/messages" className="terminal-link">MESSAGES</Link>
                <button 
                  onClick={() => setShowHelp(!showHelp)}
                  className="terminal-button-secondary px-2 py-1 text-xs"
                >
                  HELP
                </button>
              </nav>
            </div>
          </div>
        </header>

        {/* Help Overlay */}
        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
            <div className="terminal-window max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="terminal-header">
                <span className="terminal-title">System Help</span>
                <button onClick={() => setShowHelp(false)} className="text-terminal-error">
                  [X]
                </button>
              </div>
              <div className="terminal-body space-y-4">
                <div>
                  <h3 className="text-terminal-accent font-bold mb-2">LOCATION-BOUND MESSAGING</h3>
                  <p className="text-terminal-text-secondary">
                    Messages encrypted to specific GPS coordinates. Recipients must physically be at 
                    the location to decrypt.
                  </p>
                </div>
                
                <div className="terminal-divider" />
                
                <div>
                  <h3 className="text-terminal-accent font-bold mb-2">QUICK START</h3>
                  <ul className="list-disc list-inside space-y-1 text-terminal-text-secondary">
                    <li>COMPOSE: Create encrypted message bound to coordinates</li>
                    <li>MESSAGES: View stored messages</li>
                    <li>UNLOCK: Prove location to decrypt message</li>
                  </ul>
                </div>
                
                <div className="terminal-divider" />
                
                <div>
                  <h3 className="text-terminal-accent font-bold mb-2">CRYPTOGRAPHY</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-terminal-text-secondary">
                    <li>X25519: Ephemeral key exchange</li>
                    <li>AES-GCM: Authenticated encryption</li>
                    <li>HKDF: Location-bound key derivation</li>
                    <li>Ed25519: Device attestation signatures</li>
                  </ul>
                </div>
                
                <button onClick={() => setShowHelp(false)} className="terminal-button w-full mt-4">
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Terminal />} />
            <Route path="/compose" element={<ComposeMessage />} />
            <Route path="/messages" element={<MessageList />} />
            <Route path="/messages/:id" element={<MessageViewer />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-terminal-border bg-terminal-bg-secondary mt-12">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between text-xs text-terminal-dim">
              <div>LOCMSG v1.0.0 | Location-Bound Encryption System</div>
              <div className="flex items-center space-x-4">
                <span>LAN MODE</span>
                <span className="animate-pulse">●</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
