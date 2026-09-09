import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './RoomManager.js';
import { ClientToServerEvents, ServerToClientEvents } from '../shared/protocol.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const app = express();
app.use(cors());

// Serve static files from the client build in production
if (isProduction) {
  const clientBuildPath = path.join(__dirname, '../dist');
  app.use(express.static(clientBuildPath));
  console.log(`📁 Serving static files from: ${clientBuildPath}`);
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://10.0.0.30:3000',
      'http://10.0.0.30:5173',
      'https://pokerpov-wocm.onrender.com', // Add the explicit HTTPS URL
      'https://pokerpov.nimtech.xyz',        // Custom domain (Namecheap → Render)
      /\.onrender\.com$/,                    // Simplified regex
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Optimize for real-time updates
  pingInterval: 10000,
  pingTimeout: 5000,
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  roomManager.handleConnection(socket);
});

// Serve index.html for all other routes (SPA routing) in production
if (isProduction) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🃏 PokerPov Server running on port ${PORT}`);
  console.log(`  📡 Socket.io ready for connections`);
  console.log(`  🏥 Health check: http://localhost:${PORT}/health`);
  if (isProduction) {
    console.log(`  🌐 Client served from: /dist`);
  } else {
    console.log(`  🌐 LAN access: http://10.0.0.30:${PORT}`);
  }
  console.log();
});
