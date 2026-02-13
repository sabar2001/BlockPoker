import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents, ServerToClientEvents,
  RoomState, GameStateBroadcast, HandDeal, PublicPlayer,
  PlayerAction, EmoteType, TableConfig, GameLogEntry,
} from '../shared/protocol';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

class SocketService {
  private socket: TypedSocket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(): TypedSocket {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    }) as TypedSocket;

    // Wire up events to local listeners
    this.socket.on('room:state', (s) => this.emit('room:state', s));
    this.socket.on('room:player-joined', (p) => this.emit('room:player-joined', p));
    this.socket.on('room:player-left', (d) => this.emit('room:player-left', d));
    this.socket.on('room:error', (d) => this.emit('room:error', d));
    this.socket.on('game:state', (s) => this.emit('game:state', s));
    this.socket.on('game:hand', (h) => this.emit('game:hand', h));
    this.socket.on('game:round-end', (d) => this.emit('game:round-end', d));
    this.socket.on('game:new-round', () => this.emit('game:new-round'));
    this.socket.on('game:timer-update', (d) => this.emit('game:timer-update', d));
    this.socket.on('game:log', (log) => this.emit('game:log', log));
    this.socket.on('player:look-update', (d) => this.emit('player:look-update', d));
    this.socket.on('player:emote-update', (d) => this.emit('player:emote-update', d));
    this.socket.on('player:chat-update', (d) => this.emit('player:chat-update', d));
    this.socket.on('voice:offer', (d) => this.emit('voice:offer', d));
    this.socket.on('voice:answer', (d) => this.emit('voice:answer', d));
    this.socket.on('voice:ice-candidate', (d) => this.emit('voice:ice-candidate', d));
    this.socket.on('voice:speaking-update', (d) => this.emit('voice:speaking-update', d));

    this.socket.on('connect', () => this.emit('connected'));
    this.socket.on('disconnect', () => this.emit('disconnected'));

    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get id(): string | undefined {
    return this.socket?.id;
  }

  get connected(): boolean {
    return this.socket?.connected || false;
  }

  // --- Room Actions ---
  createRoom(playerName: string, buyIn: number, tableConfig?: Partial<TableConfig>): Promise<{ success: boolean; roomCode?: string; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('room:create', { playerName, buyIn, tableConfig }, resolve);
    });
  }

  joinRoom(roomCode: string, playerName: string, buyIn: number): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket?.emit('room:join', { roomCode, playerName, buyIn }, resolve);
    });
  }

  leaveRoom(): void { this.socket?.emit('room:leave'); }
  setReady(ready: boolean): void { this.socket?.emit('room:ready', { ready }); }
  updateSettings(tableConfig: Partial<TableConfig>): void { this.socket?.emit('room:settings', { tableConfig }); }
  startGame(): void { this.socket?.emit('game:start'); }
  dealNextRound(): void { this.socket?.emit('game:deal'); }

  // --- Game Actions ---
  sendAction(action: PlayerAction, amount?: number): void {
    this.socket?.emit('game:action', { action, amount });
  }

  // --- Real-time ---
  sendLook(yaw: number, pitch: number): void {
    this.socket?.volatile.emit('player:look', { yaw, pitch });
  }

  sendEmote(emote: EmoteType): void {
    this.socket?.emit('player:emote', { emote });
  }

  sendChat(message: string): void {
    this.socket?.emit('player:chat', { message });
  }

  sendSpeaking(isSpeaking: boolean): void {
    this.socket?.emit('voice:speaking', { isSpeaking });
  }

  // --- Voice Signaling ---
  sendVoiceOffer(to: string, sdp: RTCSessionDescriptionInit): void {
    this.socket?.emit('voice:offer', { to, sdp });
  }

  sendVoiceAnswer(to: string, sdp: RTCSessionDescriptionInit): void {
    this.socket?.emit('voice:answer', { to, sdp });
  }

  sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
    this.socket?.emit('voice:ice-candidate', { to, candidate });
  }

  // --- Event System ---
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(cb => cb(...args));
  }
}

// Singleton
export const socketService = new SocketService();
