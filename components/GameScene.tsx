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

const CardMesh: React.FC<{ card: CardType; position: [number, number, number]; rotation?: [number, number, number]; scale?: number }> = ({ card, position, rotation = [-Math.PI / 2, 0, 0], scale = 1 }) => {
  const faceTexture = useMemo(() => createCardFaceTexture(card.rank, card.suit), [card.rank, card.suit]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Card body */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[0.7, 1, 0.02]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      {/* Card back (blue) */}
      <mesh position={[0, 0, -0.011]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.7, 1]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      {/* Card face with rank/suit via canvas texture */}
      <mesh position={[0, 0, 0.011]}>
        <planeGeometry args={[0.7, 1]} />
        <meshBasicMaterial map={faceTexture} transparent />
      </mesh>
    </group>
  );
};

const FirstPersonHand = ({ hand }: { hand: CardType[] }) => {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame((state) => {
    if (group.current) {
      const time = state.clock.getElapsedTime();
      const bobX = Math.sin(time * 8) * 0.02;
      const bobY = Math.sin(time * 16) * 0.02;

      group.current.position.copy(camera.position);
      group.current.quaternion.copy(camera.quaternion);

      group.current.translateX(0.4 + bobX);
      group.current.translateY(-0.3 + bobY);
      group.current.translateZ(-0.6);
      group.current.rotation.z = Math.sin(time * 2) * 0.05;
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0.2, -0.2, 0.2]} rotation={[0.2, -0.2, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.6]} />
        <meshStandardMaterial color="#ffe0bd" />
      </mesh>
      {hand.map((card, i) => (
        <CardMesh
          key={i}
          card={card}
          position={[-0.1 + (i * 0.15), 0, 0]}
          rotation={[0.2, -0.1 + (i * -0.1), 0]}
          scale={0.4}
        />
      ))}
    </group>
  );
};

const PokerTable = ({ communityCards, pot }: { communityCards: CardType[], pot: number }) => {
  const cardRotations = useMemo(() => {
    return communityCards.map(() => Math.random() * 0.1);
  }, [communityCards.length]);

  return (
    <group>
      {/* Main table base - darker wood */}
      <mesh receiveShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[5.3, 5.3, 0.2, 64]} />
        <meshStandardMaterial 
          color="#5C3317" 
          roughness={0.6} 
          metalness={0.05}
        />
      </mesh>
      
      {/* Green felt playing surface - higher quality */}
      <mesh receiveShadow position={[0, 0.81, 0]}>
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

      {/* Community cards */}
      {communityCards.map((card, i) => (
        <CardMesh
          key={i}
          card={card}
          position={[-2 + (i * 1.0), 0.85, 0]}
          rotation={[-Math.PI / 2, 0, cardRotations[i] || 0]}
        />
      ))}

      {/* Pot indicator with better styling */}
      <group position={[0, 1.1, -1.8]}>
        <mesh castShadow>
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

const CloudPlatform = () => (
  <group>
    {/* Main floating platform - lowered to support table */}
    <mesh position={[0, -0.5, 0]} receiveShadow castShadow>
      <cylinderGeometry args={[8, 8, 0.4, 32]} />
      <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.1} />
    </mesh>
    {/* Platform base */}
    <mesh position={[0, -0.8, 0]}>
      <cylinderGeometry args={[8.2, 8.2, 0.1, 32]} />
      <meshStandardMaterial color="#88ccff" emissive="#88ccff" emissiveIntensity={0.3} />
    </mesh>
    
    {/* Cloud-like pillars */}
    {[0, 60, 120, 180, 240, 300].map((angle, i) => {
      const rad = angle * (Math.PI / 180);
      const x = Math.cos(rad) * 7;
      const z = Math.sin(rad) * 7;
      return (
        <mesh key={i} position={[x, -2, z]}>
          <cylinderGeometry args={[0.6, 0.8, 2, 8]} />
          <meshStandardMaterial color="#e0f2fe" emissive="#e0f2fe" emissiveIntensity={0.2} />
        </mesh>
      );
    })}
  </group>
);

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
        const yaw = Math.atan2(-x, -z); // Angle from seat to origin
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
      
      {/* Enhanced lighting for better table visibility */}
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#87CEEB', 15, 60]} />
      <ambientLight intensity={1.5} />
      <hemisphereLight args={['#87CEEB', '#ffffff', 1.5]} />
      <pointLight position={[0, 8, 0]} intensity={6} castShadow />
      <directionalLight position={[5, 8, 3]} intensity={2.5} color="#ffffff" castShadow />
      <directionalLight position={[-5, 8, -3]} intensity={1.5} color="#ffffff" />

      <PokerTable communityCards={communityCards} pot={pot} />
      <CloudPlatform />

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

      {/* Render User Hand FPS Style - hide during SHOWDOWN */}
      {user && !user.isFolded && user.hand.length > 0 && gameStage !== 4 && (
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
      <Canvas shadows camera={{ position: [0, 2, 6], fov: 90 }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
};

export default GameScene;
