import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
// Removed Text and Html from drei - they cause Suspense hang and black screen in multiplayer
import * as THREE from 'three';
import { Player } from '../types';

interface PlayerAvatarProps {
  player: Player;
  isUser?: boolean;
  currentTurnIndex: number;
  audioListener?: THREE.AudioListener;
}

// Creates a canvas-based texture for rendering text without drei's Text component
function createTextTexture(
  text: string,
  color: string,
  fontSize: number,
  bgColor?: string,
  canvasWidth = 256,
  canvasHeight = 64
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
    ctx.fill();
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Emote map for rendering emotes as sprites
const EMOTE_MAP: Record<string, string> = {
  wave: '\u{1F44B}',
  thumbsup: '\u{1F44D}',
  fistslam: '\u{1F44A}',
  laugh: '\u{1F602}',
  cry: '\u{1F62D}',
  shrug: '\u{1F937}',
};

function createEmoteTexture(emote: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 128;
  canvas.height = 128;
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = '80px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(EMOTE_MAP[emote] || '?', 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, isUser, currentTurnIndex, audioListener }) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);

  // Target rotation for smooth interpolation
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);

  // Canvas-texture for name plate (memoized, updates only when name changes)
  const nameTexture = useMemo(
    () => createTextTexture(player.name, '#ffffff', 32, 'rgba(0,0,0,0.7)', 256, 48),
    [player.name]
  );

  // Canvas-texture for bet amount
  const betTexture = useMemo(
    () => player.currentBet > 0 ? createTextTexture(`$${player.currentBet}`, '#4ade80', 36, 'rgba(0,0,0,0.6)', 192, 48) : null,
    [player.currentBet]
  );

  // Canvas-texture for emote
  const emoteTexture = useMemo(
    () => player.emote ? createEmoteTexture(player.emote) : null,
    [player.emote]
  );

  // Canvas-texture for chat message
  const chatTexture = useMemo(
    () => player.chatMessage
      ? createTextTexture(player.chatMessage, '#4ade80', 24, 'rgba(0,0,0,0.85)', 512, 48)
      : null,
    [player.chatMessage]
  );

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
      0, // Ground level, standing around table
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

      {/* Floating Name Plate - canvas-texture sprite */}
      <sprite position={[0, 2.2, 0]} scale={[2, 0.4, 1]}>
        <spriteMaterial map={nameTexture} transparent depthTest={false} />
      </sprite>

      {/* Speaking indicator */}
      {player.isSpeaking && (
        <mesh position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#4ade80" />
        </mesh>
      )}

      {/* Bet amount - canvas-texture sprite */}
      {!player.isFolded && player.currentBet > 0 && betTexture && (
        <sprite position={[0, 1.8, 0]} scale={[1.5, 0.4, 1]}>
          <spriteMaterial map={betTexture} transparent depthTest={false} />
        </sprite>
      )}

      {/* Emote display - canvas-texture sprite */}
      {player.emote && emoteTexture && (
        <sprite position={[0, 2.8, 0]} scale={[0.8, 0.8, 1]}>
          <spriteMaterial map={emoteTexture} transparent depthTest={false} />
        </sprite>
      )}

      {/* Chat Bubble - canvas-texture sprite */}
      {player.chatMessage && chatTexture && (
        <sprite position={[0, 2.6, 0]} scale={[3, 0.4, 1]}>
          <spriteMaterial map={chatTexture} transparent depthTest={false} />
        </sprite>
      )}
    </group>
  );
};

export default PlayerAvatar;
