import React, { useState, useEffect } from 'react';
import { TableConfig, DEFAULT_TABLE_CONFIG } from '../shared/protocol';
import { socketService } from '../services/socketService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: TableConfig;
  isPlaying: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentConfig, isPlaying }) => {
  const [smallBlind, setSmallBlind] = useState(currentConfig.smallBlind);
  const [bigBlind, setBigBlind] = useState(currentConfig.bigBlind);
  const [minBuyIn, setMinBuyIn] = useState(currentConfig.minBuyIn);
  const [maxBuyIn, setMaxBuyIn] = useState(currentConfig.maxBuyIn);
  const [actionTimeout, setActionTimeout] = useState(currentConfig.actionTimeout);
  const [variant, setVariant] = useState<'HOLDEM' | 'OMAHA'>(currentConfig.variant);

  useEffect(() => {
    if (isOpen) {
      setSmallBlind(currentConfig.smallBlind);
      setBigBlind(currentConfig.bigBlind);
      setMinBuyIn(currentConfig.minBuyIn);
      setMaxBuyIn(currentConfig.maxBuyIn);
      setActionTimeout(currentConfig.actionTimeout);
      setVariant(currentConfig.variant);
    }
  }, [isOpen, currentConfig]);

  const handleSave = () => {
    socketService.updateSettings({
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      actionTimeout,
      variant,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 pointer-events-auto font-[VT323]">
      <div className="bg-gray-900 border-4 border-green-500 p-6 max-w-lg w-full mx-4">
        <h2 className="text-4xl text-green-500 text-center mb-6 krunker-text">TABLE SETTINGS</h2>

        {isPlaying && (
          <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-200 px-4 py-2 mb-4 text-center text-lg">
            Settings cannot be changed during active round
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xl block mb-1">SMALL BLIND</label>
              <input
                type="number"
                value={smallBlind}
                onChange={(e) => setSmallBlind(Number(e.target.value))}
                disabled={isPlaying}
                className="w-full bg-gray-800 border-2 border-gray-600 text-white text-2xl px-3 py-2 text-center disabled:opacity-50"
                min="1"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xl block mb-1">BIG BLIND</label>
              <input
                type="number"
                value={bigBlind}
                onChange={(e) => setBigBlind(Number(e.target.value))}
                disabled={isPlaying}
                className="w-full bg-gray-800 border-2 border-gray-600 text-white text-2xl px-3 py-2 text-center disabled:opacity-50"
                min="2"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xl block mb-1">MIN BUY-IN</label>
              <input
                type="number"
                value={minBuyIn}
                onChange={(e) => setMinBuyIn(Number(e.target.value))}
                disabled={isPlaying}
                className="w-full bg-gray-800 border-2 border-gray-600 text-white text-2xl px-3 py-2 text-center disabled:opacity-50"
                min="10"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xl block mb-1">MAX BUY-IN</label>
              <input
                type="number"
                value={maxBuyIn}
                onChange={(e) => setMaxBuyIn(Number(e.target.value))}
                disabled={isPlaying}
                className="w-full bg-gray-800 border-2 border-gray-600 text-white text-2xl px-3 py-2 text-center disabled:opacity-50"
                min="100"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xl block mb-1">ACTION TIMEOUT (seconds)</label>
            <input
              type="number"
              value={actionTimeout}
              onChange={(e) => setActionTimeout(Math.max(5, Math.min(120, Number(e.target.value))))}
              disabled={isPlaying}
              className="w-full bg-gray-800 border-2 border-gray-600 text-white text-2xl px-3 py-2 text-center disabled:opacity-50"
              min="5"
              max="120"
            />
            <div className="text-gray-500 text-sm mt-1">Range: 5-120 seconds</div>
          </div>

          <div>
            <label className="text-gray-400 text-xl block mb-2">GAME VARIANT</label>
            <div className="flex gap-3">
              <button
                onClick={() => setVariant('HOLDEM')}
                disabled={isPlaying}
                className={`flex-1 py-3 text-2xl border-2 transition-colors disabled:opacity-50 ${
                  variant === 'HOLDEM'
                    ? 'bg-green-800 border-green-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-400'
                }`}
              >
                HOLD'EM
              </button>
              <button
                onClick={() => setVariant('OMAHA')}
                disabled={isPlaying}
                className={`flex-1 py-3 text-2xl border-2 transition-colors disabled:opacity-50 ${
                  variant === 'OMAHA'
                    ? 'bg-green-800 border-green-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-400'
                }`}
              >
                OMAHA
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-2xl py-3 border-2 border-gray-600 transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={isPlaying}
            className="flex-1 bg-green-800 hover:bg-green-700 text-white text-2xl py-3 border-2 border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
