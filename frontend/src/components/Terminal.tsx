import { useEffect, useState } from 'react';

const Terminal = () => {
  const [lines, setLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);

  const bootSequence = [
    '> INITIALIZING LOCMSG TERMINAL v1.0.0...',
    '> Loading cryptographic modules...',
    '> [X25519] Elliptic curve key exchange............ OK',
    '> [AES-GCM] Authenticated encryption.............. OK',
    '> [HKDF] Key derivation function.................. OK',
    '> [Ed25519] Digital signatures.................... OK',
    '',
    '> Establishing LAN connection...',
    '> WebSocket signaling server...................... OK',
    '> mDNS peer discovery............................. OK',
    '',
    '> SYSTEM READY',
    '> Location-bound messaging active',
    '',
    '═══════════════════════════════════════════════════════',
    'LOCATION-BOUND MESSAGING SYSTEM',
    '═══════════════════════════════════════════════════════',
    '',
    'Messages can only be decrypted at specific GPS coordinates.',
    'Cryptographic proof of location required for decryption.',
    '',
    'Commands:',
    '  COMPOSE  - Create location-bound message',
    '  MESSAGES - View stored messages',
    '  HELP     - Show system documentation',
    '',
    'How it works (60-second explanation):',
    '',
    '1. Sender and recipient exchange ephemeral public keys (X25519)',
    '2. Both compute same shared secret without sending it over network',
    '3. Sender derives location-bound key: K_loc = HKDF(shared_secret + coordinates + time)',
    '4. Sender encrypts message with random key K_msg, then wraps K_msg with K_loc',
    '5. Recipient proves location via signed GPS attestation',
    '6. If at correct location, recipient derives same K_loc, unwraps K_msg, decrypts message',
    '',
    'The magic: coordinates are cryptographically bound into the key derivation.',
    'Wrong location = wrong key = cannot decrypt.',
    '',
  ];

  useEffect(() => {
    if (currentLine < bootSequence.length) {
      const timer = setTimeout(() => {
        setLines(prev => [...prev, bootSequence[currentLine]]);
        setCurrentLine(prev => prev + 1);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentLine]);

  return (
    <div className="terminal-window max-w-4xl mx-auto">
      <div className="terminal-header">
        <span className="terminal-title">System Console</span>
        <div className="flex space-x-2">
          <span className="text-terminal-success">●</span>
          <span className="text-terminal-warning">●</span>
          <span className="text-terminal-error">●</span>
        </div>
      </div>
      
      <div className="terminal-body min-h-[500px] font-mono text-sm">
        {lines.map((line, i) => (
          <div key={i} className="mb-1">
            {line}
          </div>
        ))}
        {currentLine < bootSequence.length && (
          <span className="animate-blink">_</span>
        )}
      </div>
    </div>
  );
};

export default Terminal;
