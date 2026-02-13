import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './RoomManager.js';
import { ClientToServerEvents, ServerToClientEvents } from '../shared/protocol.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(cors());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://10.0.0.30:3000'],
    methods: ['GET', 'POST'],
  },
  // Optimize for real-time updates
  pingInterval: 10000,
  pingTimeout: 5000,
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  roomManager.handleConnection(socket);
});

httpServer.listen(PORT, () => {
  console.log(`\n  🃏 PokerPov Server running on port ${PORT}`);
  console.log(`  📡 Socket.io ready for connections`);
  console.log(`  🏥 Health check: http://localhost:${PORT}/health\n`);
});
