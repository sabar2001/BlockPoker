import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
// No drei Text/Html - they cause Suspense hang and black screen
import * as THREE from 'three';
import { Player, Card as CardType, Suit } from '../types';
import PlayerAvatar from './PlayerAvatar';
import { socketService } from '../services/socketService';
import { voiceService } from '../services/voiceService';

interface GameSceneProps {
  players: Player[];
  communityCards: CardType[];
  pot: number;
  currentTurnIndex: number;
  myId?: string;
  onLockChange?: (locked: boolean) => void;
  isMobile?: boolean;
  cameraRotation?: { yaw: number; pitch: number };
  onInitialYaw?: (yaw: number) => void;
  gameStage?: number;
}

// Creates a canvas texture for card faces (rank + suit)
function createCardFaceTexture(rank: string, suit: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 140;
  canvas.height = 200;

  // White card background
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(0, 0, 140, 200);

  // Border
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 136, 196);

  const isRed = suit === '\u2665' || suit === '\u2666';
  const color = isRed ? '#cc0000' : '#111111';

  // Top-left rank
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(rank, 8, 36);

  // Top-left suit (smaller)
  ctx.font = '24px serif';
  ctx.fillText(suit, 10, 60);

  // Center suit (large)
  ctx.font = '60px serif';
  ctx.textAlign = 'center';
  ctx.fillText(suit, 70, 120);

  // Bottom-right rank (upside down via rotation trick: just place it)
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(rank, 132, 188);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const CardMesh: React.FC<{ card: CardType; position: [number, number, number]; rotation?: [number, number, number]; scale?: number; doubleSided?: boolean }> = ({ card, position, rotation = [-Math.PI / 2, 0, 0], scale = 1, doubleSided = false }) => {
  const faceTexture = useMemo(() => createCardFaceTexture(card.rank, card.suit), [card.rank, card.suit]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Card body */}
      <mesh>
        <boxGeometry args={[0.7, 1, 0.02]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      {/* Card back (blue) */}
      <mesh position={[0, 0, -0.011]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.7, 1]} />
        <meshStandardMaterial color="#3b82f6" side={doubleSided ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
      {/* Card face with rank/suit via canvas texture */}
      <mesh position={[0, 0, 0.011]}>
        <planeGeometry args={[0.7, 1]} />
        <meshBasicMaterial map={faceTexture} transparent side={doubleSided ? THREE.DoubleSide : THREE.FrontSide} />
      </mesh>
    </group>
  );
};

const FirstPersonHand = ({ hand }: { hand: CardType[] }) => {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const isOmaha = hand.length === 4;

  useFrame(() => {
    if (group.current) {
      group.current.position.copy(camera.position);
      group.current.quaternion.copy(camera.quaternion);

      group.current.translateX(isOmaha ? 0 : 0.15);
      group.current.translateY(-0.2);
      group.current.translateZ(-0.6);
    }
  });

  if (isOmaha) {
    return (
      <group ref={group}>
        {/* Left hand holding first 2 cards */}
        <mesh position={[-0.2, -0.17, 0.17]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.42]} />
          <meshStandardMaterial color="#ffe0bd" />
        </mesh>
        <CardMesh card={hand[0]} position={[-0.3, 0, 0]} rotation={[0.2, 0, 0]} scale={0.27} />
        <CardMesh card={hand[1]} position={[-0.1, 0, 0]} rotation={[0.2, 0, 0]} scale={0.27} />
        {/* Right hand holding last 2 cards */}
        <mesh position={[0.2, -0.17, 0.17]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.42]} />
          <meshStandardMaterial color="#ffe0bd" />
        </mesh>
        <CardMesh card={hand[2]} position={[0.1, 0, 0]} rotation={[0.2, 0, 0]} scale={0.27} />
        <CardMesh card={hand[3]} position={[0.3, 0, 0]} rotation={[0.2, 0, 0]} scale={0.27} />
      </group>
    );
  }

  return (
    <group ref={group}>
      {/* Right hand holding 2 cards */}
      <mesh position={[0, -0.17, 0.17]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.13, 0.13, 0.5]} />
        <meshStandardMaterial color="#ffe0bd" />
      </mesh>
      <CardMesh card={hand[0]} position={[-0.13, 0, 0]} rotation={[0.2, -0.05, 0]} scale={0.34} />
      {hand[1] && <CardMesh card={hand[1]} position={[0.13, 0, 0]} rotation={[0.2, 0.05, 0]} scale={0.34} />}
    </group>
  );
};

// Y rotation so community cards face the viewer (from table center toward viewer position)
function viewerFaceYaw(viewerPosition: [number, number, number] | undefined): number {
  if (!viewerPosition) return 0;
  return Math.atan2(viewerPosition[0], viewerPosition[2]);
}

// Ease-out cubic for smooth deceleration at end
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Animated community card: flies from deck (center) to final position when dealt
const AnimatedCommunityCard: React.FC<{
  card: CardType;
  index: number;
  cardHeight: number;
  faceYaw: number;
  cardTilt: number;
  cardRotation: number;
}> = ({ card, index, cardHeight, faceYaw, cardTilt, cardRotation }) => {
  const groupRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);
  const finalX = -2 + index * 1.0;
  const finalPos = useMemo(() => new THREE.Vector3(finalX, cardHeight, 0), [finalX, cardHeight]);
  const startPos = useMemo(() => new THREE.Vector3(0, 0.5, 0), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const clock = state.clock.getElapsedTime();
    if (startTimeRef.current === null) startTimeRef.current = clock;
    const elapsed = clock - startTimeRef.current;
    const duration = 0.55;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(t);
    groupRef.current.position.lerpVectors(startPos, finalPos, eased);
    const scale = 0.65 + 0.35 * eased;
    groupRef.current.scale.setScalar(scale);
    if (t >= 1) {
      groupRef.current.position.copy(finalPos);
      groupRef.current.scale.setScalar(1);
    }
  });

  const rotation: [number, number, number] = [-Math.PI / 2 + cardTilt, faceYaw, cardRotation];
  return (
    <group ref={groupRef}>
      <CardMesh card={card} position={[0, 0, 0]} rotation={rotation} doubleSided />
    </group>
  );
};

const PokerTable = ({ communityCards, pot, viewerPosition }: { communityCards: CardType[]; pot: number; viewerPosition?: [number, number, number] }) => {
  const cardRotations = useMemo(() => {
    return communityCards.map(() => Math.random() * 0.1);
  }, [communityCards.length]);
  const faceYaw = viewerFaceYaw(viewerPosition);
  const cardTilt = 0.5;
  const cardHeight = 1.02;

  return (
    <group>
      {/* Main table base - darker wood */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[5.3, 5.3, 0.2, 64]} />
        <meshStandardMaterial 
          color="#5C3317" 
          roughness={0.6} 
          metalness={0.05}
        />
      </mesh>
      
      {/* Green felt playing surface - higher quality */}
      <mesh position={[0, 0.81, 0]}>
        <cylinderGeometry args={[4.9, 4.9, 0.01, 64]} />
        <meshStandardMaterial 
          color="#0a4d2e" 
          roughness={0.95}
          metalness={0}
        />
      </mesh>
      
      {/* Inner table edge detail */}
      <mesh position={[0, 0.82, 0]}>
        <torusGeometry args={[4.8, 0.05, 8, 64]} />
        <meshStandardMaterial 
          color="#8B7355" 
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      {/* 9 seat markers - more visible */}
      {[90, 50, 10, -30, -70, -110, -150, 170, 130].map((deg, i) => {
        const angle = deg * (Math.PI / 180);
        const x = Math.cos(angle) * 5.6;
        const z = Math.sin(angle) * 5.6;
        return (
          <group key={i} position={[x, 0.82, z]}>
            {/* Seat marker */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.35, 32]} />
              <meshStandardMaterial 
                color="#ffffff" 
                opacity={0.15} 
                transparent 
              />
            </mesh>
            {/* Seat number indicator */}
            <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.15, 16]} />
              <meshStandardMaterial 
                color="#ffd700" 
                emissive="#ffd700"
                emissiveIntensity={0.3}
              />
            </mesh>
          </group>
        );
      })}

      {/* Community cards - animate from deck to position when dealt */}
      {communityCards.map((card, i) => (
        <AnimatedCommunityCard
          key={`${i}-${card.rank}-${card.suit}`}
          card={card}
          index={i}
          cardHeight={cardHeight}
          faceYaw={faceYaw}
          cardTilt={cardTilt}
          cardRotation={cardRotations[i] || 0}
        />
      ))}

      {/* Pot indicator with better styling */}
      <group position={[0, 1.1, -1.8]}>
        <mesh>
          <boxGeometry args={[1.8, 0.5, 0.7]} />
          <meshStandardMaterial 
            color="#d4af37" 
            emissive="#d4af37" 
            emissiveIntensity={0.4}
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
        {/* Pot label backing */}
        <mesh position={[0, 0, 0.36]}>
          <planeGeometry args={[1.6, 0.4]} />
          <meshStandardMaterial 
            color="#1a1a1a"
            opacity={0.8}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
};

// Spinning disco ball — clean mirror ball with a bright glow
const DiscoBall = () => {
  const ballRef = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (ballRef.current) ballRef.current.rotation.y += dt * 0.5;
  });

  return (
    <group position={[0, 8.5, 0]}>
      {/* Mounting rod */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.4, 8]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Mirror ball */}
      <mesh ref={ballRef}>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshStandardMaterial color="#eee" emissive="#ffffff" emissiveIntensity={0.6} metalness={1} roughness={0.05} />
      </mesh>
      {/* White glow from the ball */}
      <pointLight color="#ffffff" intensity={5} distance={12} />
    </group>
  );
};

// 2 strobe lights that sweep through the room and across the table
const StrobeLights = () => {
  const refA = useRef<THREE.PointLight>(null);
  const refB = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (refA.current) {
      refA.current.position.set(Math.sin(t * 0.7) * 8, 5, Math.cos(t * 0.5) * 8);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      refA.current.intensity = 15 + pulse * 20;
    }
    if (refB.current) {
      refB.current.position.set(Math.sin(t * 0.5 + 3) * 8, 5, Math.cos(t * 0.8 + 2) * 8);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + 1);
      refB.current.intensity = 15 + pulse * 20;
    }
  });

  return (
    <>
      <pointLight ref={refA} color="#ff0066" distance={25} />
      <pointLight ref={refB} color="#0066ff" distance={25} />
    </>
  );
};

// Bodyguard figure — huge, menacing, black suit, tie, sunglasses
const Bodyguard = ({ position, rotation }: { position: [number, number, number]; rotation: number }) => {
  const s = 2.2;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={[s, s, s]}>
      {/* Legs — thick */}
      <mesh position={[-0.2, 0.55, 0]}>
        <boxGeometry args={[0.28, 1.1, 0.28]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
      </mesh>
      <mesh position={[0.2, 0.55, 0]}>
        <boxGeometry args={[0.28, 1.1, 0.28]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
      </mesh>
      {/* Torso — wide, barrel-chested */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.85, 0.95, 0.45]} />
        <meshStandardMaterial color="#080808" roughness={0.4} metalness={0.15} />
      </mesh>
      {/* Shoulders — extra bulk */}
      <mesh position={[-0.45, 1.75, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#080808" roughness={0.4} />
      </mesh>
      <mesh position={[0.45, 1.75, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#080808" roughness={0.4} />
      </mesh>
      {/* Tie */}
      <mesh position={[0, 1.45, 0.24]}>
        <boxGeometry args={[0.1, 0.6, 0.02]} />
        <meshStandardMaterial color="#8b0000" roughness={0.6} />
      </mesh>
      {/* White shirt collar peek */}
      <mesh position={[0, 1.85, 0.16]}>
        <boxGeometry args={[0.28, 0.12, 0.08]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      {/* Neck — thick */}
      <mesh position={[0, 2.05, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.18, 8]} />
        <meshStandardMaterial color="#c49a6c" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.35, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#c49a6c" roughness={0.8} />
      </mesh>
      {/* Hair — buzz cut */}
      <mesh position={[0, 2.5, -0.03]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Sunglasses — wide dark visor */}
      <mesh position={[0, 2.38, 0.26]}>
        <boxGeometry args={[0.4, 0.1, 0.03]} />
        <meshStandardMaterial color="#000" metalness={0.9} roughness={0.05} />
      </mesh>
      {/* Arms — thick, crossed in front */}
      <mesh position={[-0.5, 1.35, 0.15]} rotation={[0.3, 0, 0.2]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#080808" roughness={0.5} />
      </mesh>
      <mesh position={[0.5, 1.35, 0.15]} rotation={[0.3, 0, -0.2]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial color="#080808" roughness={0.5} />
      </mesh>
      {/* Fists */}
      <mesh position={[-0.42, 0.95, 0.3]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#c49a6c" roughness={0.8} />
      </mesh>
      <mesh position={[0.42, 0.95, 0.3]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#c49a6c" roughness={0.8} />
      </mesh>
      {/* Shoes — big */}
      <mesh position={[-0.2, 0.05, 0.08]}>
        <boxGeometry args={[0.28, 0.1, 0.4]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.3} />
      </mesh>
      <mesh position={[0.2, 0.05, 0.08]}>
        <boxGeometry args={[0.28, 0.1, 0.4]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.3} />
      </mesh>
    </group>
  );
};

// Luxury casino club room environment
const CasinoRoom = () => {
  const wallHeight = 10;
  const roomRadius = 16;

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[roomRadius, 64]} />
        <meshStandardMaterial color="#2a1218" emissive="#2a1218" emissiveIntensity={0.3} roughness={0.3} metalness={0.3} />
      </mesh>
      {/* Carpet accent ring under table */}
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.5, 10, 64]} />
        <meshStandardMaterial color="#4a0020" emissive="#4a0020" emissiveIntensity={0.2} roughness={0.85} metalness={0} />
      </mesh>

      {/* Walls — seamless cylinder so no gaps */}
      <mesh position={[0, wallHeight / 2 - 0.1, 0]}>
        <cylinderGeometry args={[roomRadius, roomRadius, wallHeight, 64, 1, true]} />
        <meshStandardMaterial color="#35161e" emissive="#35161e" emissiveIntensity={0.7} roughness={0.85} metalness={0} side={THREE.BackSide} />
      </mesh>

      {/* Gold crown moulding ring at wall top */}
      <mesh position={[0, wallHeight - 0.3, 0]}>
        <torusGeometry args={[roomRadius, 0.12, 8, 64]} />
        <meshStandardMaterial color="#d4af37" emissive="#d4af37" emissiveIntensity={0.8} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, wallHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[roomRadius, 64]} />
        <meshStandardMaterial color="#2a1018" emissive="#2a1018" emissiveIntensity={0.5} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Gold pillar columns around the room */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = deg * (Math.PI / 180);
        const x = Math.cos(rad) * (roomRadius - 1);
        const z = Math.sin(rad) * (roomRadius - 1);
        return (
          <group key={`pillar-${i}`}>
            <mesh position={[x, wallHeight / 2 - 0.1, z]}>
              <cylinderGeometry args={[0.25, 0.3, wallHeight, 12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.25} />
            </mesh>
            {/* Capital */}
            <mesh position={[x, wallHeight - 0.1, z]}>
              <cylinderGeometry args={[0.4, 0.25, 0.3, 12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.25} />
            </mesh>
            {/* Base */}
            <mesh position={[x, 0, z]}>
              <cylinderGeometry args={[0.25, 0.4, 0.3, 12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
        );
      })}

      {/* Velvet rope barriers between some pillars */}
      {[30, 90, 150, 210, 270, 330].map((deg, i) => {
        const rad = deg * (Math.PI / 180);
        const x = Math.cos(rad) * (roomRadius - 1.5);
        const z = Math.sin(rad) * (roomRadius - 1.5);
        return (
          <group key={`rope-${i}`}>
            {/* Rope post */}
            <mesh position={[x, 0.5, z]}>
              <cylinderGeometry args={[0.06, 0.06, 1, 8]} />
              <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[x, 1, z]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        );
      })}

      {/* Disco ball */}
      <DiscoBall />

      {/* 2 strobe lights that sweep room and table */}
      <StrobeLights />

      {/* Bodyguards — three menacing figures around the room */}
      <Bodyguard position={[-12, 0, -8]} rotation={Math.PI / 4} />
      <Bodyguard position={[12, 0, -8]} rotation={-Math.PI / 4} />
      <Bodyguard position={[0, 0, 13]} rotation={Math.PI} />
    </group>
  );
};

// Positions camera at player's seat for first-person view, facing table center
const CameraPositioner = ({ playerPosition, onInitialYaw }: { playerPosition?: [number, number, number]; onInitialYaw?: (yaw: number) => void }) => {
  const { camera } = useThree();
  const targetPosition = useRef<[number, number, number] | null>(null);
  const initialLookSet = useRef(false);
  
  React.useEffect(() => {
    if (playerPosition) {
      targetPosition.current = [playerPosition[0], 1.6, playerPosition[2]];
      initialLookSet.current = false; // Reset on position change
      console.log('[CameraPositioner] Target position set:', targetPosition.current);
    }
  }, [playerPosition]);
  
  useFrame(() => {
    if (targetPosition.current) {
      const [x, y, z] = targetPosition.current;
      camera.position.set(x, y, z);

      // Set initial look direction toward table center (once)
      if (!initialLookSet.current) {
        // Camera default forward is -Z. To face origin from (x,z), yaw = atan2(x, z).
        const yaw = Math.atan2(x, z);
        const euler = new THREE.Euler(-0.3, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);
        initialLookSet.current = true;
        console.log('[CameraPositioner] Initial look set, yaw:', yaw);
        // Propagate yaw to parent so TouchCameraControls starts correct
        onInitialYaw?.(yaw);
      }
    }
  });
  
  return null;
};

// Custom camera controller for desktop (replaces PointerLockControls)
const DesktopCameraControls = () => {
  const { camera } = useThree();
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const initialized = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;

      // Initialize euler from current camera rotation on first mouse move
      if (!initialized.current) {
        euler.current.setFromQuaternion(camera.quaternion, 'YXZ');
        initialized.current = true;
      }

      const sensitivity = 0.002;
      euler.current.y -= e.movementX * sensitivity;
      euler.current.x -= e.movementY * sensitivity;
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x));

      camera.quaternion.setFromEuler(euler.current);
    };

    const handleLockChange = () => {
      const locked = !!document.pointerLockElement;
      if (locked) {
        // Re-sync euler from camera when pointer lock is acquired
        euler.current.setFromQuaternion(camera.quaternion, 'YXZ');
        initialized.current = true;
      }
      console.log('[DesktopCameraControls] Pointer lock changed:', locked);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handleLockChange);

    console.log('[DesktopCameraControls] Initialized');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, [camera]);

  return null;
};

// Touch-based camera controls for mobile
const TouchCameraControls = ({ yaw, pitch }: { yaw: number; pitch: number }) => {
  const { camera } = useThree();
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    console.log('[TouchCameraControls] Initialized with rotation:', { yaw, pitch });
    // Mark ready after camera is available
    if (camera) {
      setIsReady(true);
    }
  }, [camera, yaw, pitch]);

  useFrame(() => {
    if (!isReady) return; // Don't apply rotation until ready
    // Apply rotation from touch input
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  });

  return null;
};

// Broadcasts camera look direction to server at ~15fps
const LookBroadcaster = ({ isMobile }: { isMobile?: boolean }) => {
  const { camera } = useThree();
  const lastSent = useRef(0);
  const euler = useRef(new THREE.Euler());

  useFrame(() => {
    // On mobile, don't broadcast - rotation is already sent by MobileControls
    if (isMobile) return;
    
    const now = Date.now();
    if (now - lastSent.current < 66) return; // ~15fps
    lastSent.current = now;

    euler.current.setFromQuaternion(camera.quaternion, 'YXZ');
    socketService.sendLook(euler.current.y, euler.current.x);
  });

  return null;
};

// Updates proximity/directional audio volumes every frame
const VoiceSpatialUpdater = ({ players, myId }: { players: Player[]; myId?: string }) => {
  const { camera } = useThree();
  const forward = useRef(new THREE.Vector3());

  useFrame(() => {
    camera.getWorldDirection(forward.current);
    const myPos: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
    const myFwd: [number, number, number] = [forward.current.x, forward.current.y, forward.current.z];

    const peerPositions = new Map<string, [number, number, number]>();
    for (const p of players) {
      if (p.id !== myId) {
        peerPositions.set(p.id, p.position);
      }
    }

    voiceService.updateSpatialAudio(myPos, myFwd, peerPositions);
  });

  return null;
};

const SceneContent: React.FC<GameSceneProps> = ({ players, communityCards, pot, currentTurnIndex, myId, isMobile, cameraRotation, onInitialYaw, gameStage }) => {
  const { camera } = useThree();
  const [listener] = useState(() => new THREE.AudioListener());

  useEffect(() => {
    camera.add(listener);
    console.log('[SceneContent] Initialized', { isMobile, cameraRotation, playersCount: players.length });
    return () => { camera.remove(listener); };
  }, [camera, listener]);

  const user = players.find(p => p.id === myId);

  return (
    <>
      <CameraPositioner playerPosition={user?.position} onInitialYaw={onInitialYaw} />
      {isMobile ? (
        <TouchCameraControls yaw={cameraRotation?.yaw || 0} pitch={cameraRotation?.pitch || -0.3} />
      ) : (
        <DesktopCameraControls />
      )}
      <LookBroadcaster isMobile={isMobile} />
      <VoiceSpatialUpdater players={players} myId={myId} />
      
      {/* Casino club atmosphere */}
      <color attach="background" args={['#1a0e14']} />
      <fog attach="fog" args={['#1a0e14', 25, 45]} />
      <ambientLight intensity={2.0} color="#886666" />
      <hemisphereLight args={['#775555', '#443333', 1.2]} />
      {/* Main overhead light on the table */}
      <pointLight position={[0, 7, 0]} intensity={12} color="#ffe8cc" distance={20} />
      <directionalLight position={[3, 8, 2]} intensity={2.5} color="#ffddaa" />

      <PokerTable communityCards={communityCards} pot={pot} viewerPosition={user?.position} />
      <CasinoRoom />

      {/* Render all players (PlayerAvatar hides self) */}
      {players.map(p => (
        <PlayerAvatar
          key={p.id}
          player={p}
          isUser={p.id === myId}
          currentTurnIndex={currentTurnIndex}
          audioListener={listener}
        />
      ))}

      {/* Render User Hand FPS Style - desktop only, hide during SHOWDOWN and on mobile */}
      {user && !user.isFolded && user.hand.length > 0 && gameStage !== 4 && !isMobile && (
        <FirstPersonHand hand={user.hand} />
      )}
    </>
  );
};

const LoadingFallback = () => (
  <mesh position={[0, 0, -2]}>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial color="red" wireframe />
  </mesh>
);

const GameScene: React.FC<GameSceneProps> = (props) => {
  const { onLockChange, isMobile, cameraRotation } = props;
  const [isLocked, setIsLocked] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsLocked(locked);
      onLockChange?.(locked);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.pointerLockElement) {
        document.exitPointerLock();
      }
    };
    
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onLockChange]);

  const handleCanvasClick = () => {
    console.log('[GameScene] Canvas clicked', { isMobile, isLocked });
    if (!isMobile && !isLocked && canvasRef.current) {
      console.log('[GameScene] Requesting pointer lock');
      canvasRef.current.requestPointerLock();
    }
  };

  return (
    <div className="w-full h-full relative" ref={canvasRef} style={{ zIndex: 0 }}>
      {!isMobile && !isLocked && (
        <div 
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={handleCanvasClick}
          style={{ background: 'transparent' }}
        />
      )}
      <Canvas camera={{ position: [0, 2, 6], fov: 90 }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
};

export default GameScene;
