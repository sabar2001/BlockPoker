import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls, Sky, Stars, Text, Float, Box, Plane, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Player, Card as CardType, Suit } from '../types';
import PlayerAvatar from './PlayerAvatar';
import { DEFAULT_FONT } from '../constants';

interface GameSceneProps {
  players: Player[];
  communityCards: CardType[];
  pot: number;
  currentTurnIndex: number;
}

const CardMesh: React.FC<{ card: CardType; position: [number, number, number]; rotation?: [number, number, number]; scale?: number }> = ({ card, position, rotation = [-Math.PI / 2, 0, 0], scale = 1 }) => {
  const getColor = (suit: Suit) => (suit === Suit.HEARTS || suit === Suit.DIAMONDS) ? '#ff4444' : '#111';
  
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[0.7, 1, 0.02]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      {/* Card Back */}
      <mesh position={[0, 0, -0.011]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.7, 1]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      {/* Rank & Suit - Simple Text for blocky look */}
      <Text position={[0, 0, 0.02]} fontSize={0.5} color={getColor(card.suit)} font={DEFAULT_FONT}>
        {card.rank}{card.suit}
      </Text>
    </group>
  );
};

// First Person Weapon-like Hand
const FirstPersonHand = ({ hand }: { hand: CardType[] }) => {
    const group = useRef<THREE.Group>(null);
    const { camera } = useThree();

    useFrame((state) => {
        if (group.current) {
            // Bobbing effect
            const time = state.clock.getElapsedTime();
            const bobX = Math.sin(time * 8) * 0.02;
            const bobY = Math.sin(time * 16) * 0.02;
            
            // Stick to camera but slightly in front
            group.current.position.copy(camera.position);
            group.current.quaternion.copy(camera.quaternion);
            
            // Offset to bottom right like a weapon
            group.current.translateX(0.4 + bobX);
            group.current.translateY(-0.3 + bobY);
            group.current.translateZ(-0.6);

            // Sway
            group.current.rotation.z = Math.sin(time * 2) * 0.05;
        }
    });

    return (
        <group ref={group}>
             {/* The "Arm" */}
             <mesh position={[0.2, -0.2, 0.2]} rotation={[0.2, -0.2, 0]}>
                <boxGeometry args={[0.15, 0.15, 0.6]} />
                <meshStandardMaterial color="#ffe0bd" />
             </mesh>
            
             {/* The Cards held like a gun */}
             {hand.map((card, i) => (
                 <CardMesh 
                    key={i} 
                    card={card} 
                    position={[-0.1 + (i * 0.15), 0, 0]} 
                    rotation={[0.2, -0.1 + (i*-0.1), 0]} // Fan them slightly
                    scale={0.4}
                 />
             ))}
        </group>
    );
};

const PokerTable = ({ communityCards, pot }: { communityCards: CardType[], pot: number }) => {
  return (
    <group>
      {/* Table Top - Octagon for more blocky feel */}
      <mesh receiveShadow position={[0, -0.2, 0]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[5, 5, 0.2, 8]} /> 
        <meshStandardMaterial color="#1f2937" roughness={0.8} /> {/* Dark Grey/Blue */}
      </mesh>
      {/* Table Inner Felt */}
      <mesh receiveShadow position={[0, -0.19, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[4.5, 4.5, 0.21, 8]} />
        <meshStandardMaterial color="#10b981" roughness={0.9} /> {/* Emerald Green */}
      </mesh>

      {/* Community Cards */}
      {communityCards.map((card, i) => (
        <CardMesh 
          key={i} 
          card={card} 
          position={[-2 + (i * 1.0), 0.05, 0]} 
          rotation={[-Math.PI / 2, 0, Math.random() * 0.1]} 
        />
      ))}

      {/* Pot Display - Floating Block */}
      <Float speed={3} rotationIntensity={0.5} floatIntensity={0.5}>
        <group position={[0, 1.5, 0]}>
            <mesh>
                <boxGeometry args={[1.5, 0.5, 0.1]} />
                <meshStandardMaterial color="#000" opacity={0.7} transparent />
            </mesh>
            <Text
              position={[0, 0, 0.06]}
              fontSize={0.3}
              color="#fbbf24"
              anchorX="center"
              anchorY="middle"
              font={DEFAULT_FONT}
            >
              POT: ${pot}
            </Text>
        </group>
      </Float>
    </group>
  );
};

// Floor helper - Grid style
const Floor = () => {
  return (
    <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#050505" />
        </mesh>
        <gridHelper args={[100, 50, '#333', '#111']} position={[0, -2.9, 0]} />
    </group>
  );
}

const Walls = () => {
    return (
        <group>
            {/* Simple walls for "Arena" feel */}
            <mesh position={[0, 5, -20]}>
                <boxGeometry args={[40, 20, 1]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[0, 5, 20]}>
                <boxGeometry args={[40, 20, 1]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[-20, 5, 0]} rotation={[0, Math.PI/2, 0]}>
                <boxGeometry args={[40, 20, 1]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[20, 5, 0]} rotation={[0, Math.PI/2, 0]}>
                <boxGeometry args={[40, 20, 1]} />
                <meshStandardMaterial color="#222" />
            </mesh>
        </group>
    )
}

const SceneContent: React.FC<GameSceneProps> = ({ players, communityCards, pot, currentTurnIndex }) => {
  const { camera } = useThree();
  const [listener] = useState(() => new THREE.AudioListener());

  useEffect(() => {
    camera.add(listener);
    return () => {
      camera.remove(listener);
    };
  }, [camera, listener]);

  const user = players[0];

  return (
    <>
      <PointerLockControls />
      <Sky sunPosition={[100, 20, 100]} turbidity={0.5} rayleigh={0.2} />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 10, 0]} intensity={1.5} castShadow />
      
      <PokerTable communityCards={communityCards} pot={pot} />
      <Floor />
      <Walls />

      {/* Render Other Players */}
      {players.map(p => (
        <PlayerAvatar 
          key={p.id} 
          player={p} 
          isUser={!p.isBot} 
          currentTurnIndex={currentTurnIndex} 
          audioListener={listener} 
        />
      ))}

      {/* Render User Hand "FPS Style" */}
      {!user.isFolded && <FirstPersonHand hand={user.hand} />}
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
  return (
    <div className="w-full h-full">
      <Canvas shadows camera={{ position: [0, 2, 6], fov: 90 }}>
        <Suspense fallback={<LoadingFallback />}>
          <SceneContent {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default GameScene;