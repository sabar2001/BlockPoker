import React, { useState, useEffect } from 'react';
import { socketService } from '../services/socketService';
import { RoomState, DEFAULT_TABLE_CONFIG, TableConfig } from '../shared/protocol';

interface LobbyProps {
  onGameStart: () => void;
}

type Screen = 'menu' | 'create' | 'join' | 'waiting';

const Lobby: React.FC<LobbyProps> = ({ onGameStart }) => {
  const [screen, setScreen] = useState<Screen>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [buyIn, setBuyIn] = useState(1000);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Table config (host only)
  const [smallBlind, setSmallBlind] = useState(DEFAULT_TABLE_CONFIG.smallBlind);
  const [bigBlind, setBigBlind] = useState(DEFAULT_TABLE_CONFIG.bigBlind);
  const [minBuyIn, setMinBuyIn] = useState(DEFAULT_TABLE_CONFIG.minBuyIn);
  const [maxBuyIn, setMaxBuyIn] = useState(DEFAULT_TABLE_CONFIG.maxBuyIn);

  useEffect(() => {
    socketService.connect();

    const unsubs = [
      socketService.on('connected', () => setIsConnected(true)),
      socketService.on('disconnected', () => setIsConnected(false)),
      socketService.on('room:state', (state: RoomState) => {
        setRoomState(state);
        if (state.status === 'playing') onGameStart();
      }),
      socketService.on('room:error', (data: { message: string }) => setError(data.message)),
    ];

    return () => unsubs.forEach(u => u());
  }, [onGameStart]);

  const handleCreate = async () => {
    if (!playerName.trim()) { setError('Enter your name'); return; }
    setError('');
    const tableConfig: Partial<TableConfig> = {
      smallBlind, bigBlind, minBuyIn, maxBuyIn,
    };
    const result = await socketService.createRoom(playerName.trim(), buyIn, tableConfig);
    if (result.success) {
      setScreen('waiting');
    } else {
      setError(result.error || 'Failed to create room');
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) { setError('Enter your name'); return; }
    if (!roomCode.trim()) { setError('Enter room code'); return; }
    setError('');
    const result = await socketService.joinRoom(roomCode.trim(), playerName.trim(), buyIn);
    if (result.success) {
      setScreen('waiting');
    } else {
      setError(result.error || 'Failed to join');
    }
  };

  const handleReady = () => {
    const me = roomState?.players.find(p => p.id === socketService.id);
    socketService.setReady(!me?.isReady);
  };

  const handleStartGame = () => {
    socketService.startGame();
  };

  const isHost = roomState?.hostId === socketService.id;
  const allReady = roomState ? roomState.players.length >= 1 && roomState.players.every(p => p.isReady) : false;

  return (
    <div className="w-full h-full flex items-center justify-center bg-black font-[VT323]">
      <div className="w-full max-w-lg mx-4">

        {/* Title */}
        <h1 className="text-6xl text-green-500 text-center krunker-text mb-8 animate-pulse">
          POKERPOV
        </h1>

        {!isConnected && (
          <div className="text-yellow-400 text-center text-xl mb-4 animate-pulse">
            CONNECTING TO SERVER...
          </div>
        )}

        {error && (
          <div className="bg-red-900/80 border border-red-500 text-red-200 text-lg px-4 py-2 mb-4 text-center">
            {error}
          </div>
        )}

        {/* Main Menu */}
        {screen === 'menu' && (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="YOUR NAME"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
              className="bg-gray-900 border-2 border-green-500 text-white text-2xl px-4 py-3 text-center uppercase outline-none focus:border-green-300"
            />
            <button
              onClick={() => setScreen('create')}
              disabled={!isConnected || !playerName.trim()}
              className="bg-green-800 hover:bg-green-700 text-white text-3xl py-4 border-2 border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              CREATE ROOM
            </button>
            <button
              onClick={() => setScreen('join')}
              disabled={!isConnected || !playerName.trim()}
              className="bg-blue-800 hover:bg-blue-700 text-white text-3xl py-4 border-2 border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              JOIN ROOM
            </button>
          </div>
        )}

        {/* Create Room */}
        {screen === 'create' && (
          <div className="flex flex-col gap-3">
            <div className="text-green-400 text-2xl text-center mb-2">TABLE SETTINGS</div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-gray-400 text-lg">SMALL BLIND</label>
              <input type="number" value={smallBlind} onChange={e => setSmallBlind(Number(e.target.value))}
                className="bg-gray-900 border border-gray-600 text-white text-lg px-3 py-1 text-center outline-none" />

              <label className="text-gray-400 text-lg">BIG BLIND</label>
              <input type="number" value={bigBlind} onChange={e => setBigBlind(Number(e.target.value))}
                className="bg-gray-900 border border-gray-600 text-white text-lg px-3 py-1 text-center outline-none" />

              <label className="text-gray-400 text-lg">MIN BUY-IN</label>
              <input type="number" value={minBuyIn} onChange={e => setMinBuyIn(Number(e.target.value))}
                className="bg-gray-900 border border-gray-600 text-white text-lg px-3 py-1 text-center outline-none" />

              <label className="text-gray-400 text-lg">MAX BUY-IN</label>
              <input type="number" value={maxBuyIn} onChange={e => setMaxBuyIn(Number(e.target.value))}
                className="bg-gray-900 border border-gray-600 text-white text-lg px-3 py-1 text-center outline-none" />
            </div>

            <div className="text-green-400 text-2xl text-center mt-2">YOUR BUY-IN</div>
            <input type="number" value={buyIn} min={minBuyIn} max={maxBuyIn}
              onChange={e => setBuyIn(Math.max(minBuyIn, Math.min(maxBuyIn, Number(e.target.value))))}
              className="bg-gray-900 border-2 border-yellow-500 text-yellow-300 text-3xl px-4 py-2 text-center outline-none" />

            <div className="flex gap-3 mt-2">
              <button onClick={() => setScreen('menu')}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-2xl py-3 border-2 border-gray-600 transition-colors">
                BACK
              </button>
              <button onClick={handleCreate}
                className="flex-1 bg-green-800 hover:bg-green-700 text-white text-2xl py-3 border-2 border-green-500 transition-colors">
                CREATE
              </button>
            </div>
          </div>
        )}

        {/* Join Room */}
        {screen === 'join' && (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="ROOM CODE"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              className="bg-gray-900 border-2 border-blue-500 text-white text-3xl px-4 py-3 text-center uppercase tracking-[0.5em] outline-none font-mono"
              maxLength={6}
            />

            <div className="text-green-400 text-2xl text-center">YOUR BUY-IN</div>
            <input type="number" value={buyIn} min={200} max={5000}
              onChange={e => setBuyIn(Math.max(200, Math.min(5000, Number(e.target.value))))}
              className="bg-gray-900 border-2 border-yellow-500 text-yellow-300 text-3xl px-4 py-2 text-center outline-none" />
            <div className="text-gray-500 text-sm text-center">Table limits shown after joining</div>

            <div className="flex gap-3">
              <button onClick={() => setScreen('menu')}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-2xl py-3 border-2 border-gray-600 transition-colors">
                BACK
              </button>
              <button onClick={handleJoin}
                className="flex-1 bg-blue-800 hover:bg-blue-700 text-white text-2xl py-3 border-2 border-blue-500 transition-colors">
                JOIN
              </button>
            </div>
          </div>
        )}

        {/* Waiting Room */}
        {screen === 'waiting' && roomState && (
          <div className="flex flex-col gap-4">
            {/* Room Code */}
            <div
              className="bg-gray-900 border-2 border-green-500 p-4 text-center cursor-pointer hover:border-green-300 transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(roomState.roomCode);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 1500);
              }}
            >
              <div className="text-gray-400 text-lg">ROOM CODE (click to copy)</div>
              <div className="text-green-400 text-5xl tracking-[0.5em] font-mono">{roomState.roomCode}</div>
              {copiedCode && <div className="text-yellow-300 text-lg mt-1">Copied!</div>}
            </div>

            {/* Table Info */}
            <div className="bg-gray-900/50 border border-gray-700 p-3 text-center text-gray-400 text-lg">
              Blinds: {roomState.tableConfig.smallBlind}/{roomState.tableConfig.bigBlind} | 
              Buy-in: {roomState.tableConfig.minBuyIn}-{roomState.tableConfig.maxBuyIn} | 
              {roomState.tableConfig.variant}
            </div>

            {/* Player List */}
            <div className="bg-gray-900/80 border border-gray-700 p-3">
              <div className="text-gray-400 text-lg mb-2">
                PLAYERS ({roomState.players.length}/9)
              </div>
              {roomState.players.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-white text-xl">
                      {p.name}
                      {p.id === roomState.hostId && <span className="text-yellow-400 ml-2">[HOST]</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-yellow-300 text-lg">${p.chips}</span>
                    <span className={`text-lg ${p.isReady ? 'text-green-400' : 'text-gray-600'}`}>
                      {p.isReady ? 'READY' : 'NOT READY'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => { socketService.leaveRoom(); setRoomState(null); setScreen('menu'); }}
                className="flex-1 bg-red-900 hover:bg-red-800 text-white text-2xl py-3 border-2 border-red-500 transition-colors">
                LEAVE
              </button>
              <button onClick={handleReady}
                className="flex-1 bg-blue-800 hover:bg-blue-700 text-white text-2xl py-3 border-2 border-blue-500 transition-colors">
                {roomState.players.find(p => p.id === socketService.id)?.isReady ? 'UNREADY' : 'READY'}
              </button>
              {isHost && (
                <button onClick={handleStartGame} disabled={!allReady}
                  className="flex-1 bg-green-800 hover:bg-green-700 text-white text-2xl py-3 border-2 border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  START
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
