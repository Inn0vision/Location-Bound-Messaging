# Network Setup Guide - Running on Different WiFi

This guide explains how to run the Location-Bound Messaging System on different WiFi networks.

## Prerequisites
- Computer and mobile device on the **same WiFi network**
- Both frontend and backend servers running

## Setup Steps

### 1. Start the Servers

```bash
# Terminal 1 - Backend (Simplified Server)
cd backend
pnpm run dev:simple

# Terminal 2 - Frontend
cd frontend
pnpm run dev
```

You should see:
```
Backend:  http://localhost:3001 (or http://0.0.0.0:3001)
Frontend: http://localhost:5173
```

### 2. Find Your Computer's IP Address

**On Linux:**
```bash
ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | cut -d/ -f1 | head -1
```

**On Mac:**
```bash
ipconfig getifaddr en0
```

**On Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your WiFi adapter
```

**Example IPs you might see:**
- `192.168.1.50` (common home routers)
- `192.168.0.105` (common home routers)
- `10.0.0.23` (some routers)
- `172.16.0.10` (some office networks)

### 3. Access from Mobile

Open your mobile browser and go to:
```
http://<YOUR_IP>:5173
```

**Example:**
```
http://192.168.1.50:5173
```

### 4. Verify Connection

The app should:
- ✅ Load the UI correctly
- ✅ Automatically connect to backend at `http://<YOUR_IP>:3001`
- ✅ Send and receive messages successfully

Check the browser console (mobile developer tools) to see:
```
Server URL: http://192.168.1.50:3001
```

## How It Works

The frontend **automatically detects** the server URL:
- If you access via `localhost:5173` → connects to `localhost:3001`
- If you access via `192.168.1.50:5173` → connects to `192.168.1.50:3001`
- If you access via `10.0.0.23:5173` → connects to `10.0.0.23:3001`

This is handled in `frontend/src/SimpleApp.tsx`:
```typescript
const getServerUrl = () => {
  const currentHost = window.location.hostname;
  return `http://${currentHost}:3001`;
};
```

## Changing WiFi Networks

When you switch to a **different WiFi network**:

1. **Stop the servers** (Ctrl+C in both terminals)
2. **Connect both devices to the new WiFi**
3. **Find your new IP address** (Step 2 above)
4. **Restart the servers** (Step 1 above)
5. **Access from mobile using the new IP**

**Example:**
```
Old network: http://192.168.1.50:5173
New network: http://10.0.0.23:5173
```

## Troubleshooting

### Mobile can't connect to the server

**Check 1: Both devices on same WiFi?**
```bash
# On computer, check connected network
nmcli device show | grep GENERAL.CONNECTION
# or
iwconfig
```

**Check 2: Firewall blocking ports?**
```bash
# Check if ports are open
sudo ufw status
# or
sudo iptables -L -n | grep -E "(3001|5173)"
```

**Check 3: Can you ping the computer from mobile?**
- Install a ping app on mobile
- Ping your computer's IP: `192.168.1.50`
- If ping fails → network/firewall issue

**Check 4: Backend listening on all interfaces?**
```bash
# Should show 0.0.0.0:3001 (not 127.0.0.1:3001)
ss -tlnp | grep 3001
```

Expected output:
```
0.0.0.0:3001    0.0.0.0:*    (GOOD - accessible from network)
127.0.0.1:3001  0.0.0.0:*    (BAD - only accessible from localhost)
```

### Wrong server URL in browser

**Solution 1: Hard refresh the page**
- Chrome/Firefox on mobile: Pull down to refresh or clear cache
- Or access in private/incognito mode

**Solution 2: Check environment variables**
```bash
# Make sure VITE_SERVER_URL is not set (or set correctly)
cat frontend/.env
```

**Solution 3: Check browser console**
- Open mobile dev tools (if available)
- Look for the server URL being used
- Should match your computer's IP

### Messages not syncing between devices

This is **expected behavior**! 
- Messages are stored in backend memory (RAM)
- Each message has location coordinates
- To decrypt, you must be at the correct GPS location

**Test it works:**
1. Send message from computer (set destination to your current location)
2. Receive message from mobile (use same GPS coordinates)
3. Should decrypt successfully if coordinates match!

## Network Security Notes

### LAN/Local Network Access
- Your app is accessible to **anyone on the same WiFi**
- No authentication by default
- Fine for demos and testing
- **NOT suitable for public networks** (coffee shops, airports, etc.)

### Public WiFi (NOT RECOMMENDED)
If you must use public WiFi:
1. Use a VPN on both devices
2. Add authentication to the backend
3. Use HTTPS (requires SSL certificates)

### Production Deployment
For real-world use, you need:
- ✅ Domain name (e.g., `myapp.com`)
- ✅ SSL/TLS certificates (HTTPS)
- ✅ Authentication & authorization
- ✅ Database for persistent storage
- ✅ Rate limiting
- ✅ Firewall rules

See main [README.md](README.md#-security) for more security considerations.

## Using Docker (Alternative Method)

If you have Docker installed, you can use a more portable setup:

```bash
# Build and start containers
docker-compose up -d

# Find your IP
hostname -I

# Access from mobile
http://<YOUR_IP>:5173
```

Docker ensures consistent environment across different networks.

## LAN Discovery (Advanced)

The backend includes **mDNS** service discovery:
- Advertises itself as `locmsg.http.local`
- Other devices can find it automatically
- Useful for offline/LAN-only operation

To test:
```bash
# On Linux, install avahi-browse
sudo apt install avahi-utils

# Discover services
avahi-browse -a
```

## Summary Checklist

When moving to a **new WiFi network**:

- [ ] Connect computer to new WiFi
- [ ] Connect mobile to same WiFi
- [ ] Find new IP address: `ip addr show` or `hostname -I`
- [ ] Start backend: `pnpm run dev:simple`
- [ ] Start frontend: `pnpm run dev`
- [ ] Check backend listening on `0.0.0.0:3001`
- [ ] Open mobile browser: `http://<NEW_IP>:5173`
- [ ] Refresh page to load updated code
- [ ] Test sending/receiving messages
- [ ] Success! 🎉

---

**Remember:** The frontend automatically uses the correct backend URL based on how you access it. No manual configuration needed!
