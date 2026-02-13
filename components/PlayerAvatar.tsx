import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Player } from '../types';
import { PLAYER_POSITIONS, DEFAULT_FONT } from '../constants';

interface PlayerAvatarProps {
  player: Player;
  isUser?: boolean;
  currentTurnIndex: number;
  audioListener?: THREE.AudioListener;
}

// Utility to decode Base64
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Utility to decode PCM
async function decodePCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, isUser, currentTurnIndex, audioListener }) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const audioRef = useRef<THREE.PositionalAudio>(null);
  
  useFrame((state) => {
    if (groupRef.current && !isUser) {
      // Idle float
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 3 + parseInt(player.id)) * 0.1;
      
      // Face center
      groupRef.current.lookAt(0, 0, 0);
    }
  });

  // Handle Audio Playback
  useEffect(() => {
    if (player.lastAudioData && audioRef.current && !isUser) {
        const playAudio = async () => {
             try {
                 const rawBytes = decodeBase64(player.lastAudioData!);
                 const context = THREE.AudioContext.getContext();
                 if (context.state === 'suspended') await context.resume();

                 const buffer = await decodePCM(rawBytes, context);
                 
                 if (audioRef.current) {
                     if (audioRef.current.isPlaying) audioRef.current.stop();
                     audioRef.current.setBuffer(buffer);
                     audioRef.current.setRefDistance(2); 
                     audioRef.current.setRolloffFactor(1); 
                     audioRef.current.setVolume(1.5); 
                     audioRef.current.play();
                 }
             } catch (e) {
                 console.error("Failed to play bot audio", e);
             }
        };
        playAudio();
    }
  }, [player.lastAudioData, isUser]);

  if (isUser) return null; // Don't render self avatar body, handled in GameScene as FirstPersonHand

  return (
    <group ref={groupRef} position={new THREE.Vector3(...player.position)}>
      {audioListener && (
           <positionalAudio ref={audioRef} args={[audioListener]} />
      )}

      {/* Krunker Style Body - Just boxes */}
      {/* Torso */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.8, 0.9, 0.5]} />
        <meshStandardMaterial color={player.isFolded ? '#333' : player.color} />
      </mesh>
      
      {/* Head */}
      <mesh ref={headRef} position={[0, 1.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#ffe0bd" />
          
           {/* Sunglasses / Visor */}
          <mesh position={[0, 0.1, 0.26]}>
              <boxGeometry args={[0.4, 0.1, 0.05]} />
              <meshStandardMaterial color="black" />
          </mesh>
      </mesh>

      {/* Legs (Static for now) */}
      <mesh position={[-0.2, -0.2, 0]} castShadow>
        <boxGeometry args={[0.25, 0.6, 0.25]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.2, -0.2, 0]} castShadow>
        <boxGeometry args={[0.25, 0.6, 0.25]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* Floating Name Plate */}
      <group position={[0, 2.2, 0]}>
          <mesh>
             <boxGeometry args={[player.name.length * 0.15, 0.3, 0.05]} />
             <meshStandardMaterial color="black" opacity={0.6} transparent />
          </mesh>
          <Text
            position={[0, 0, 0.04]}
            fontSize={0.2}
            color="#fff"
            anchorX="center"
            anchorY="middle"
            font={DEFAULT_FONT}
          >
            {player.name} [LVL {player.chips > 2000 ? '99' : '10'}]
          </Text>
      </group>

      {/* Action Text */}
      {!player.isFolded && player.currentBet > 0 && (
         <Text
         position={[0, 1.8, 0]}
         fontSize={0.25}
         color="#4ade80"
         anchorX="center"
         anchorY="middle"
         outlineWidth={0.02}
         outlineColor="black"
         font={DEFAULT_FONT}
       >
         ${player.currentBet}
       </Text>
      )}

       {/* Chat Bubble - Krunker Style */}
       {player.chatMessage && (
        <Html position={[0, 2.6, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'VT323' }} className="bg-black/80 text-green-400 px-2 py-1 border border-green-500 text-lg uppercase shadow-lg">
            {player.chatMessage}
          </div>
        </Html>
       )}
    </group>
  );
};

export default PlayerAvatar;