# Local Network Multiplayer Setup

## Testing with your roommate on the same WiFi

### Step 1: Find Your Local IP

On macOS:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

On Windows:
```bash
ipconfig
```

Look for something like `192.168.1.XXX` or `10.0.0.XXX`

### Step 2: Update `.env.local`

Edit `.env.local` and set your IP:

```env
VITE_SERVER_URL=http://192.168.1.100:3001
```

Replace `192.168.1.100` with YOUR actual IP.

### Step 3: Run the servers

```bash
npm run dev:all
```

The client runs on port `3000`, server on port `3001`.

### Step 4: Connect

**You (host):**
- Open `http://localhost:3000` or `http://YOUR_IP:3000`
- Create a room
- Share the 6-character room code

**Your roommate:**
- Open `http://YOUR_IP:3000` (replace YOUR_IP with your actual IP)
- Join room with the code you shared

### Troubleshooting

**If your roommate can't connect:**

1. Check firewall - allow ports 3000 and 3001
2. Make sure you're both on the same WiFi network
3. Try accessing `http://YOUR_IP:3000` from your own phone first to test

**macOS Firewall:**
```bash
# Check if firewall is blocking
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Allow Node.js (if needed)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

## Internet Multiplayer (beyond LAN)

For playing over the internet (not same WiFi), you have free options:

### Option 1: ngrok (easiest)
```bash
# Install ngrok
brew install ngrok

# In one terminal, run your servers
npm run dev:all

# In another terminal, tunnel the client
ngrok http 3000

# And tunnel the server
ngrok http 3001
```

You'll get URLs like:
- Client: `https://abc123.ngrok.io`
- Server: `https://xyz456.ngrok.io`

Update `.env.local`:
```env
VITE_SERVER_URL=https://xyz456.ngrok.io
```

Share the client URL with your friend.

### Option 2: Cloudflare Tunnel (free, no signup needed)
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Tunnel both ports
cloudflared tunnel --url http://localhost:3000
cloudflared tunnel --url http://localhost:3001
```

### Option 3: Tailscale (VPN for gaming)
Creates a virtual LAN over the internet - your friend joins your "network" and uses your IP as if on same WiFi.

## Production Deployment (later)

For real production hosting:
- **Frontend**: Deploy to Vercel/Netlify (free)
- **Backend**: Deploy to Render/Railway/Fly.io (free tier available)
- Set `VITE_SERVER_URL` to your production server URL
