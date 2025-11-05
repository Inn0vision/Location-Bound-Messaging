# Location-Bound Messaging System

> **Decrypt messages only when you're physically at the right place**

A demonstration of location-bound cryptography where encrypted messages can only be decrypted when the recipient is at specific GPS coordinates. Features end-to-end encryption with a terminal-style "hacker aesthetic" UI.

[![License](https://img.shields.io/badge/license-Educational-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)](tsconfig.json)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Modern web browser (Chrome, Firefox, Edge)
- Basic understanding of cryptography (helpful but not required)

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd location-bound-messaging

# Install all dependencies
npm run install-all

# Start development servers
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/api/health

### Using Docker (Alternative)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 📖 What Is This?

This project demonstrates **location-bound encryption** - a cryptographic technique that ties decryption keys to specific geographic coordinates.

### How It Works (60 Seconds)

1. **Key Exchange:** Sender and recipient establish a shared secret using Diffie-Hellman (X25519)
2. **Location Binding:** Sender creates a location-specific key using:
   ```
   K_loc = HKDF(shared_secret || latitude || longitude || radius || time)
   ```
3. **Double Encryption:** Message encrypted with random key, then that key is wrapped with the location-bound key
4. **Unlocking:** Recipient must:
   - Be at the correct GPS coordinates (within specified radius)
   - Be within the time window
   - Use the correct shared secret

**The Result:** Wrong location → Wrong key → Cannot decrypt ❌

---

## 🎯 Features

### Cryptography
- **X25519** - Elliptic-curve Diffie-Hellman key exchange
- **AES-GCM** - Authenticated encryption for messages
- **HKDF** - Key derivation to bind keys to location
- **Ed25519** - Digital signatures for location attestation
- **HMAC-SHA256** - Message integrity checking

### Application
- ✅ End-to-end encrypted messaging
- ✅ Location-bound key derivation
- ✅ Time-window enforcement
- ✅ Interactive map-based location picker
- ✅ Distance calculation (Haversine formula)
- ✅ Terminal-style UI (green-on-black aesthetic)
- ✅ REST API + WebSocket support
- ✅ LAN/offline capability (mDNS discovery)

---

## 🎮 Demo Walkthrough

### 1. Generate Key Pairs

Both sender and recipient need key pairs. Open browser console (F12):

```javascript
import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';

// Generate sender keys
const senderKeys = nacl.box.keyPair();
console.log('Sender Public:', util.encodeBase64(senderKeys.publicKey));
console.log('Sender Private:', util.encodeBase64(senderKeys.secretKey));

// Generate recipient keys
const recipientKeys = nacl.box.keyPair();
console.log('Recipient Public:', util.encodeBase64(recipientKeys.publicKey));
console.log('Recipient Private:', util.encodeBase64(recipientKeys.secretKey));
```

### 2. Compose a Message

Navigate to **COMPOSE** in the UI:

1. Enter your secret message
2. Paste recipient's public key
3. Click on the map to set target location (or enter coordinates)
4. Set geofence radius (e.g., 100 meters)
5. Set time window (e.g., "Next 24 hours")
6. Click **ENCRYPT & STORE**

Your message is now encrypted and bound to that location!

### 3. View Messages

Navigate to **MESSAGES**:

- See all stored messages
- Each shows lock status: `LOCKED` 🔒 / `UNLOCKABLE` 🔓 / `EXPIRED` ⏰
- Click to view details

### 4. Unlock a Message

In the message viewer:

1. Enter your current GPS coordinates
   - **Demo mode:** Manually enter coordinates
   - **Production:** Would use browser Geolocation API
2. Paste recipient's private key
3. Click **UNLOCK MESSAGE**

**If at correct location:** Message decrypts successfully! ✅  
**If wrong location:** Error shows distance from target ❌

### 5. Test Location Binding

Try the following experiments:

- Enter coordinates far from target → Unlock fails
- Enter coordinates near target (within radius) → Success!
- Wait past expiration time → Unlock fails
- Use wrong private key → Decryption fails

---

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │◄───────►│    Backend       │◄───────►│   Frontend      │
│   (Sender)      │  HTTPS  │  (Relay/Store)   │  HTTPS  │  (Recipient)    │
│                 │         │                  │         │                 │
│  React SPA      │  WS     │ Node.js/Express  │  WS     │  React SPA      │
│  Terminal UI    │◄───────►│  WebSocket       │◄───────►│  Terminal UI    │
│  Crypto (Web)   │         │  mDNS Discovery  │         │  Crypto (Web)   │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Leaflet (maps)
- TweetNaCl + Web Crypto API

**Backend:**
- Node.js 18+ with Express
- WebSocket server
- TweetNaCl (crypto)
- mDNS (local discovery)

---

## 📁 Project Structure

```
location-bound-messaging/
├── backend/              # Node.js server
│   ├── src/
│   │   ├── crypto.ts    # Crypto primitives
│   │   ├── location.ts  # Location verification
│   │   └── index.ts     # Express app + WebSocket
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/             # React SPA
│   ├── src/
│   │   ├── components/  # UI components
│   │   │   ├── Terminal.tsx
│   │   │   ├── ComposeMessage.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── MessageViewer.tsx
│   │   ├── lib/
│   │   │   └── crypto.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── examples/             # Crypto demonstrations
│   ├── 01-key-exchange.ts
│   ├── 02-location-key.ts
│   └── 03-full-flow.ts
│
├── docs/                 # Additional documentation
├── SPEC.md              # Complete specification
├── README.md            # This file
├── package.json         # Monorepo root
└── docker-compose.yml   # Container orchestration
```

---

## 🔐 Security

### Threat Model

**What This Protects Against:**
- ✅ Eavesdropping (end-to-end encryption)
- ✅ Message tampering (authenticated encryption)
- ✅ Wrong-location decryption (location-bound keys)
- ✅ Replay attacks (timestamps + nonces)
- ✅ Basic GPS spoofing (multi-point verification)

**What This Does NOT Protect Against:**
- ❌ Advanced GPS spoofing with SDR equipment ($200+ hardware)
- ❌ Compromised devices
- ❌ Side-channel attacks
- ❌ Quantum computers (post-quantum crypto needed)
- ❌ Social engineering

### ⚠️ Important Warnings

**This is an educational/demo implementation!**

- Consumer GPS can be spoofed with readily available hardware
- No hardware attestation (TPM/Secure Enclave)
- In-memory storage only (data lost on restart)
- Simplified anti-spoofing checks
- No production-grade key management

**DO NOT use this in production without:**
1. Professional security audit
2. Hardware attestation integration
3. Persistent secure storage
4. Rate limiting and DDoS protection
5. Comprehensive logging and monitoring
6. Legal review (location tracking regulations)

---

## 📚 Documentation

- **[SPEC.md](SPEC.md)** - Complete technical specification with:
  - Detailed cryptography explanations
  - Sequence diagrams
  - API documentation
  - Security considerations
  - MVP checklist

- **[Examples](examples/)** - Crypto demonstration scripts:
  - `01-key-exchange.ts` - Diffie-Hellman demo
  - `02-location-key.ts` - Location-bound key derivation
  - `03-full-flow.ts` - Complete encrypt/decrypt flow

---

## 🧪 Testing

Run unit tests for crypto and location functions:

```bash
# Run all tests
npm test

# Test backend only
npm run test:backend

# Test frontend only
npm run test:frontend
```

---

## 🛠️ Development

### Available Scripts

```bash
npm run install-all       # Install all dependencies
npm run dev               # Start both frontend + backend
npm run dev:frontend      # Start frontend only
npm run dev:backend       # Start backend only
npm run build             # Build for production
npm run test              # Run all tests
npm run docker:up         # Start Docker containers
npm run docker:down       # Stop Docker containers
```

### Environment Variables

**Backend (.env):**
```bash
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
```

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

---

## 🎨 UI Design

Terminal-style cyber aesthetic with green-on-black color scheme:

- Monospace fonts throughout
- Neon green text (`#00ff00`)
- ASCII art borders
- Command-line interactions
- Matrix-style effects

See [SPEC.md](SPEC.md#uiux-design) for complete design tokens.

---

## 🚧 Roadmap

### Completed ✅
- Core cryptographic implementation
- Location-bound key derivation
- REST API + WebSocket server
- React UI with terminal theme
- Message compose/view/unlock flows
- Distance calculation and verification

### Planned 🔮
- [ ] WebRTC P2P data channels
- [ ] Real Geolocation API integration
- [ ] Hardware attestation (TPM/Secure Enclave)
- [ ] Continuous presence verification
- [ ] WiFi/cellular context matching
- [ ] Mobile app (React Native)
- [ ] QR code key exchange
- [ ] Multi-recipient support
- [ ] Threshold decryption

---

## 🤝 Contributing

This is an educational project. Contributions welcome for:

- Bug fixes
- Documentation improvements
- Example scripts
- Test coverage
- Security enhancements

Please open an issue before submitting large PRs.

---

## 📄 License

Educational/Demo Use Only. See [LICENSE](LICENSE) for details.

**Not for production deployment without professional security review.**

---

## 🙏 Acknowledgments

Built to demonstrate location-bound cryptography concepts. Inspired by:

- Dead drop geocaching communities
- Location-based access control research
- Modern cryptographic protocols (Signal, TLS)

---

## 📞 Support

For questions, issues, or feature requests:

1. Check [SPEC.md](SPEC.md) for detailed documentation
2. Review [examples/](examples/) for code samples
3. Open a GitHub issue
4. Contact project maintainers

---

## 💡 Educational Use Cases

This project is ideal for learning about:

- End-to-end encryption principles
- Key derivation functions
- Authenticated encryption (AES-GCM)
- Elliptic-curve cryptography (X25519, Ed25519)
- Location-based security
- WebRTC and P2P networking
- React + TypeScript development
- Terminal-style UI design

---

**Remember:** This is a teaching tool. Real-world deployment requires professional security audit and additional safeguards. GPS spoofing is possible with consumer hardware!

---

Made with ❤️ for the crypto education community
