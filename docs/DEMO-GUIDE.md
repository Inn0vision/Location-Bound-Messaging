# QUICK START GUIDE - Faculty Demo

## Simple Location-Bound Messaging Demo

This is a simplified version using **SHA-256 + XOR encryption** that's easy to explain to faculty.

---

## How It Works

1. **Officer 1** enters a message and picks a destination location on a map
2. System uses **SHA-256** to create an encryption key from the coordinates
3. Message is encrypted with **XOR cipher** using that key
4. **Officer 2** tries to decrypt at their current location
5. ✅ If at correct location → decrypts successfully
6. ❌ If at wrong location → stays encrypted (gibberish)

---

## Local Network Setup (For Faculty Demo)

### Step 1: Start the Backend Server

```bash
cd backend
npm run dev:simple
```

You'll see output like:
```
Server running on: http://localhost:3001
LAN access:        http://<your-ip>:3001

ACCESS FROM OTHER DEVICES ON YOUR NETWORK:
  http://192.168.1.100:3001
  http://10.0.0.5:3001
```

**Copy one of those URLs** - you'll need it for the frontend.

### Step 2: Configure Frontend for LAN Access

Edit `frontend/src/SimpleApp.tsx`:

```typescript
// Change this line (around line 13):
const [serverUrl] = useState('http://localhost:3001');

// To your server's LAN IP:
const [serverUrl] = useState('http://192.168.1.100:3001');
```

Or use environment variable:

```bash
cd frontend
echo "VITE_SERVER_URL=http://192.168.1.100:3001" > .env
```

Then update SimpleApp.tsx:
```typescript
const [serverUrl] = useState(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
```

### Step 3: Start the Frontend

```bash
cd frontend
npm run dev
```

You'll see:
```
Local:   http://localhost:5174/
Network: http://192.168.1.100:5174/
```

### Step 4: Access from Multiple Devices

Now anyone on your network can access:

- **Officer 1 (Sender):** http://192.168.1.100:5174/
- **Officer 2 (Receiver):** http://192.168.1.100:5174/
- **Faculty observers:** http://192.168.1.100:5174/

---

## Demo Script for Faculty

### Act 1: Sending Encrypted Message

**Officer 1's device:**

1. Click **"SEND MESSAGE"** tab
2. Enter message: `"Meet at safehouse tonight"`
3. Click on map to set destination
4. Click **"ENCRYPT & SEND MESSAGE"**
5. Show faculty the **encrypted output** (gibberish)

**Explain to faculty:**
> "We used SHA-256 to hash the latitude and longitude into an encryption key. Then we XOR'd the message with that key. Now it's just random bytes - completely unreadable."

### Act 2: Wrong Location (Failure)

**Officer 2's device:**

1. Click **"RECEIVE MESSAGE"** tab
2. Select the message from Officer 1
3. Set current location to **WRONG place** (click far away on map)
4. Click **"TRY TO DECRYPT MESSAGE"**
5. Show **DECRYPTION FAILED** message

**Explain to faculty:**
> "At this wrong location, SHA-256 creates a DIFFERENT key. When we try to decrypt with the wrong key, we just get more gibberish."

### Act 3: Correct Location (Success!)

**Officer 2's device:**

1. Move current location to **CORRECT place** (inside the red circle)
2. Click **"TRY TO DECRYPT MESSAGE"** again
3. Show **DECRYPTION SUCCESSFUL** and the **original message**!

**Explain to faculty:**
> "Now we're at the right coordinates! SHA-256 recreates the EXACT SAME key from these coordinates. XOR with the correct key gives us back the original message. This only works at this specific location!"

---

## Key Points to Emphasize

### 1. SHA-256 is Deterministic
- Same input (lat/lon) → Always same output (key)
- Different input → Completely different output
- No way to reverse it

### 2. XOR Properties
- Simple to understand: `A XOR B XOR B = A`
- Encrypting twice = decrypting
- Wrong key = random garbage

### 3. Location Binding
- Encryption key is cryptographically tied to GPS coordinates
- Can't decrypt without being at the location
- Adjustable radius (10m - 500m)

### 4. No Key Transmission
- No keys are ever sent over the network
- Only encrypted data is transmitted
- Both parties derive the key from location independently

---

## Troubleshooting

### Backend won't start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill process if needed
kill -9 <PID>
```

### Frontend can't connect to backend
```bash
# Make sure backend is running
curl http://localhost:3001/health

# Check firewall
sudo ufw allow 3001
sudo ufw allow 5174
```

### Can't access from other devices
- Make sure all devices are on the **same WiFi network**
- Check if firewall is blocking ports
- Use your computer's **local IP** (192.168.x.x or 10.0.x.x)

---

## Technical Details (For Curious Faculty)

### Encryption Algorithm

```python
# Step 1: Create location-based key
location_string = f"{lat},{lon}"
key = SHA256(location_string)  # 32 bytes

# Step 2: XOR encryption
encrypted = []
for i, byte in enumerate(message):
    encrypted.append(byte ^ key[i % len(key)])

# Step 3: To decrypt at correct location
decrypted = []
for i, byte in enumerate(encrypted):
    decrypted.append(byte ^ key[i % len(key)])
```

### Why XOR?
- **Educational:** Easy to explain and visualize
- **Symmetric:** Same operation for encrypt/decrypt
- **Fast:** Single CPU instruction per byte
- **Demonstrable:** Can show bit-by-bit operation

### Security Notes for Production

This simplified version is for **demonstration purposes**. For production:

1. Use AES-GCM instead of XOR
2. Add message authentication (HMAC)
3. Include timestamp in key derivation
4. Use secure location attestation
5. Add replay protection
6. Implement key rotation

---

## Questions Faculty Might Ask

### Q: Can someone brute force the location?
**A:** With enough computing power, yes. But:
- Each attempt requires trying coordinates
- 6 decimal place precision = millions of combinations
- Can add rate limiting
- Production systems use additional security layers

### Q: What if GPS is spoofed?
**A:** This demo doesn't prevent spoofing. Production systems use:
- Hardware-backed location attestation
- Multiple location sources (GPS, WiFi, cell towers)
- Trusted execution environments (TEEs)
- Challenge-response protocols

### Q: Why not use AES?
**A:** We could! But for educational purposes:
- XOR is simpler to explain in 5 minutes
- Shows the core concept clearly
- Faculty can understand bit-level operations
- AES would add complexity without changing the concept

### Q: Is this secure enough for real military use?
**A:** No! This is a proof-of-concept. Real systems need:
- Hardware security modules (HSMs)
- Secure location attestation
- Multi-factor authentication
- Audit logging
- Compliance with security standards (e.g., FIPS 140-2)

---

## Files You Modified

- `backend/src/simple-crypto.ts` - Simple SHA-256 + XOR encryption
- `backend/src/simple-server.ts` - Simplified API server
- `frontend/src/SimpleApp.tsx` - Clean two-tab UI
- `frontend/src/components/SendMessage.tsx` - Sender interface
- `frontend/src/components/ReceiveMessage.tsx` - Receiver interface

---

## Next Steps After Demo

If faculty are interested:

1. **Add Timestamp Binding** - Messages only decrypt during specific time window
2. **Add Multi-Location** - Message unlocks at ANY of several locations
3. **Add Progress Tracking** - Unlock as you get closer to location
4. **Add Audit Log** - Record all decryption attempts
5. **Add Real Attestation** - Use device TPM for secure location proof

---

Good luck with your demo! 🚀
