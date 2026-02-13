import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Player } from '../types';
import { DEFAULT_FONT } from '../constants';

interface PlayerAvatarProps {
  player: Player;
  isUser?: boolean;
  currentTurnIndex: number;
  audioListener?: THREE.AudioListener;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, isUser, currentTurnIndex, audioListener }) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);

  // Target rotation for smooth interpolation
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current || isUser) return;

    // Idle float
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 3 + (parseInt(player.id) || 0)) * 0.1;

    // Body faces table center
    groupRef.current.lookAt(0, 0, 0);

    // Head rotation driven by network data (lerp for smoothness)
    if (headRef.current && player.lookYaw !== undefined && player.lookPitch !== undefined) {
      targetYaw.current = player.lookYaw;
      targetPitch.current = player.lookPitch;

      // Lerp head rotation toward target
      const lerpSpeed = 8 * delta;
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetYaw.current, lerpSpeed);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetPitch.current, lerpSpeed);
    }
  });

  if (isUser) return null;

  return (
    <group ref={groupRef} position={new THREE.Vector3(
      player.position[0],
      0.4, // Sitting height at table level
      player.position[2]
    )}>
      {/* Torso */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.8, 0.9, 0.5]} />
        <meshStandardMaterial color={player.isFolded ? '#333' : player.color} />
      </mesh>

      {/* Head - rotation driven by network look direction */}
      <mesh ref={headRef} position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#ffe0bd" />
        {/* Sunglasses */}
        <mesh position={[0, 0.1, 0.26]}>
          <boxGeometry args={[0.4, 0.1, 0.05]} />
          <meshStandardMaterial color="black" />
        </mesh>
      </mesh>

      {/* Legs */}
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
        <Text position={[0, 0, 0.04]} fontSize={0.2} color="#fff" anchorX="center" anchorY="middle" font={DEFAULT_FONT}>
          {player.name}
        </Text>
      </group>

      {/* Speaking indicator */}
      {player.isSpeaking && (
        <mesh position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#4ade80" />
        </mesh>
      )}

      {/* Bet amount */}
      {!player.isFolded && player.currentBet > 0 && (
        <Text position={[0, 1.8, 0]} fontSize={0.25} color="#4ade80" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="black" font={DEFAULT_FONT}>
          ${player.currentBet}
        </Text>
      )}

      {/* Emote display */}
      {player.emote && (
        <Html position={[0, 2.8, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
          <div className="text-4xl animate-bounce">
            {player.emote === 'wave' && '👋'}
            {player.emote === 'thumbsup' && '👍'}
            {player.emote === 'fistslam' && '👊'}
            {player.emote === 'laugh' && '😂'}
            {player.emote === 'cry' && '😭'}
            {player.emote === 'shrug' && '🤷'}
          </div>
        </Html>
      )}

      {/* Chat Bubble */}
      {player.chatMessage && (
        <Html position={[0, 2.6, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'VT323' }} className="bg-black/80 text-green-400 px-2 py-1 border border-green-500 text-lg uppercase shadow-lg whitespace-nowrap">
            {player.chatMessage}
          </div>
        </Html>
      )}
    </group>
  );
};

export default PlayerAvatar;
