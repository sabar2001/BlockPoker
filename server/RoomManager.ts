import { Server, Socket } from 'socket.io';
import { GameManager } from './GameManager.js';
import {
  ClientToServerEvents, ServerToClientEvents,
  RoomState, RoomStatus, TableConfig, DEFAULT_TABLE_CONFIG,
} from '../shared/protocol.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface Room {
  code: string;
  hostId: string;
  game: GameManager;
  status: RoomStatus;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map();
  private io: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  handleConnection(socket: TypedSocket): void {
    console.log(`[+] ${socket.id} connected`);

    socket.on('room:create', (data, callback) => {
      this.leaveRoom(socket);
      let code = generateRoomCode();
      while (this.rooms.has(code)) code = generateRoomCode();

      const tableConfig: Partial<TableConfig> = data.tableConfig || {};
      const room: Room = {
        code,
        hostId: socket.id,
        game: new GameManager({
          onStateChange: () => this.io.to(code).emit('game:state', room.game.getGameState()),
          onRoundEnd: (w, a) => { this.io.to(code).emit('game:round-end', { winners: w, winAmount: a }); room.status = 'between_rounds'; },
          onNewRound: () => { this.io.to(code).emit('game:new-round'); room.status = 'playing'; },
          onDealHand: (pid, cards) => this.io.to(pid).emit('game:hand', { cards }),
          onTimerUpdate: (pid, time) => this.io.to(code).emit('game:timer-update', { playerId: pid, timeRemaining: time }),
          onLog: (log) => this.io.to(code).emit('game:log', log),
        }, tableConfig),
        status: 'waiting',
      };

      this.rooms.set(code, room);
      const player = room.game.addPlayer(socket.id, data.playerName, data.buyIn);
      if (!player) { callback({ success: false, error: 'Failed to create room' }); return; }

      this.playerRooms.set(socket.id, code);
      socket.join(code);
      console.log(`[Room] ${code} created by ${data.playerName}`);
      callback({ success: true, roomCode: code });
      this.broadcastRoomState(room);
    });

    socket.on('room:join', (data, callback) => {
      const code = data.roomCode.toUpperCase();
      const room = this.rooms.get(code);
      if (!room) { callback({ success: false, error: 'Room not found' }); return; }
      
      // Allow joining at any time - players can join between hands or sit out current hand

      console.log(`[Room] Join attempt by ${data.playerName} to ${code}: isPlaying=${room.game.isPlaying}, waitingForDeal=${room.game.waitingForDeal}`);

      this.leaveRoom(socket);
      const player = room.game.addPlayer(socket.id, data.playerName, data.buyIn);
      if (!player) { callback({ success: false, error: 'Room is full' }); return; }

      this.playerRooms.set(socket.id, code);
      socket.join(code);
      console.log(`[Room] ${data.playerName} joined ${code} (buy-in: ${player.chips}, mid-game=${room.status === 'playing'})`);
      callback({ success: true });

      this.io.to(code).emit('room:player-joined', {
        id: player.id, name: player.name, chips: player.chips,
        isFolded: false, isAllIn: false, currentBet: 0,
        seatIndex: player.seatIndex, color: player.color,
        hasActed: false, isReady: false,
        lookYaw: 0, lookPitch: 0, isSpeaking: false,
      });
      this.broadcastRoomState(room);
      
      // Send current game state to newly joined player immediately
      socket.emit('game:state', room.game.getGameState());
    });

    socket.on('room:leave', () => this.leaveRoom(socket));

    socket.on('room:ready', (data) => {
      const room = this.getPlayerRoom(socket.id);
      if (!room) return;
      const p = room.game.players.find(pl => pl.id === socket.id);
      if (p) { p.isReady = data.ready; this.broadcastRoomState(room); }
    });

    socket.on('room:settings', (data) => {
      const room = this.getPlayerRoom(socket.id);
      if (!room || room.hostId !== socket.id) return;
      if (data.tableConfig) {
        room.game.updateConfig(data.tableConfig);
        this.broadcastRoomState(room);
      }
    });

    socket.on('game:start', () => {
      const room = this.getPlayerRoom(socket.id);
      if (!room || room.hostId !== socket.id) return;
      if (room.game.startGame()) {
        room.status = 'playing';
        this.broadcastRoomState(room);
      } else {
        socket.emit('room:error', { message: 'Need at least 1 player to start' });
      }
    });

    socket.on('game:deal', () => {
      const room = this.getPlayerRoom(socket.id);
      if (!room || room.hostId !== socket.id) return;
      if (room.game.waitingForDeal) {
        room.game.startNewRound();
        room.status = 'playing';
      }
    });

    socket.on('game:action', (data) => {
      const room = this.getPlayerRoom(socket.id);
      if (room) room.game.processAction(socket.id, data.action, data.amount);
    });

    socket.on('game:rebuy', (data, callback) => {
      const room = this.getPlayerRoom(socket.id);
      if (!room) { callback({ success: false, error: 'Not in a room' }); return; }
      const result = room.game.rebuy(socket.id, data.amount);
      callback(result);
      if (result.success) {
        this.broadcastRoomState(room);
      }
    });

    socket.on('game:show-cards', () => {
      const room = this.getPlayerRoom(socket.id);
      if (!room) return;
      const result = room.game.showCards(socket.id);
      if (result) {
        this.io.to(room.code).emit('game:cards-revealed', {
          playerId: socket.id,
          playerName: result.playerName,
          cards: result.cards,
        });
      }
    });

    // Real-time interaction
    socket.on('player:look', (data) => {
      const room = this.getPlayerRoom(socket.id);
      if (!room) return;
      room.game.updateLook(socket.id, data.yaw, data.pitch);
      socket.to(room.code).volatile.emit('player:look-update', {
        playerId: socket.id, yaw: data.yaw, pitch: data.pitch,
      });
    });

    socket.on('player:emote', (data) => {
      const room = this.getPlayerRoom(socket.id);
      if (!room) return;
      room.game.setEmote(socket.id, data.emote);
      this.io.to(room.code).emit('player:emote-update', { playerId: socket.id, emote: data.emote });
    });

    socket.on('player:chat', (data) => {
      const room = this.getPlayerRoom(socket.id);
      if (!room) return;
      const msg = data.message.slice(0, 100);
      room.game.setChatMessage(socket.id, msg);
      this.io.to(room.code).emit('player:chat-update', { playerId: socket.id, message: msg });
    });

    // Voice signaling relay
    socket.on('voice:offer', (d) => this.io.to(d.to).emit('voice:offer', { from: socket.id, sdp: d.sdp }));
    socket.on('voice:answer', (d) => this.io.to(d.to).emit('voice:answer', { from: socket.id, sdp: d.sdp }));
    socket.on('voice:ice-candidate', (d) => this.io.to(d.to).emit('voice:ice-candidate', { from: socket.id, candidate: d.candidate }));
    socket.on('voice:speaking', (d) => {
      const room = this.getPlayerRoom(socket.id);
      if (!room) return;
      room.game.setSpeaking(socket.id, d.isSpeaking);
      socket.to(room.code).emit('voice:speaking-update', { playerId: socket.id, isSpeaking: d.isSpeaking });
    });

    socket.on('disconnect', () => { console.log(`[-] ${socket.id} disconnected`); this.leaveRoom(socket); });
  }

  private leaveRoom(socket: TypedSocket): void {
    const code = this.playerRooms.get(socket.id);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) { this.playerRooms.delete(socket.id); return; }

    room.game.removePlayer(socket.id);
    this.playerRooms.delete(socket.id);
    socket.leave(code);
    this.io.to(code).emit('room:player-left', { playerId: socket.id });

    const remaining = room.game.players.filter(p => p.isConnected);
    if (remaining.length === 0) {
      room.game.cleanup();
      this.rooms.delete(code);
      console.log(`[Room] ${code} destroyed`);
    } else {
      if (room.hostId === socket.id) room.hostId = remaining[0].id;
      this.broadcastRoomState(room);
    }
  }

  private getPlayerRoom(socketId: string): Room | null {
    const code = this.playerRooms.get(socketId);
    return code ? this.rooms.get(code) || null : null;
  }

  private broadcastRoomState(room: Room): void {
    const state: RoomState = {
      roomCode: room.code, status: room.status,
      players: room.game.getPublicPlayers(),
      hostId: room.hostId,
      tableConfig: room.game.tableConfig,
      maxPlayers: 9,
    };
    this.io.to(room.code).emit('room:state', state);
  }
}
