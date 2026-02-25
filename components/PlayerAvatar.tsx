import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Player } from '../types';

interface PlayerAvatarProps {
  player: Player;
  isUser?: boolean;
  currentTurnIndex: number;
  audioListener?: THREE.AudioListener;
}

function createTextTexture(
  text: string, color: string, fontSize: number,
  bgColor?: string, canvasWidth = 256, canvasHeight = 64
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

const EMOTE_MAP: Record<string, string> = {
  wave: '\u{1F44B}', thumbsup: '\u{1F44D}', fistslam: '\u{1F44A}',
  laugh: '\u{1F602}', cry: '\u{1F62D}', shrug: '\u{1F937}',
};

function createEmoteTexture(emote: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 128; canvas.height = 128;
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = '80px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(EMOTE_MAP[emote] || '?', 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Seeded PRNG from player ID — produces a sequence of deterministic values
function seededRng(str: string) {
  let s = 0;
  for (let i = 0; i < str.length; i++) {
    s = ((s << 5) - s + str.charCodeAt(i)) | 0;
  }
  s = Math.abs(s) || 1;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return Math.abs(s);
  };
}

// --- Accessory pools (9 each = 1 per max seat, minimizing repeats) ---

const SKIN_TONES = ['#ffe0bd', '#f5d0a9', '#e8b896', '#d4a574', '#c49a6c', '#a97c50', '#8d5524', '#6b3a1f', '#5c3a1e'];
const HAIR_COLORS = ['#0a0505', '#2b1810', '#4a2a18', '#8b6914', '#c45c26', '#e8a050', '#d4af37', '#888', '#f0f0f0'];

// --- Outfits: wild, funky, very distinct ---
interface OutfitDef {
  top: string;       // main jacket/shirt color
  topAccent: string;  // lapel, collar, pattern accent
  shirt: string;
  tie: string;
  pants: string;
  shoes: string;
  metalness: number;  // jacket sheen
  emissive?: string;  // glow on the jacket
}

const OUTFITS: OutfitDef[] = [
  // 0: Neon purple leather
  { top: '#7b2d8e', topAccent: '#bf55ec', shirt: '#111', tie: '#bf55ec', pants: '#2a1040', shoes: '#1a1a1a', metalness: 0.4, emissive: '#3a1050' },
  // 1: Gold sequin blazer
  { top: '#d4af37', topAccent: '#ffdd55', shirt: '#111', tie: '#111', pants: '#111', shoes: '#222', metalness: 0.7, emissive: '#4a3a10' },
  // 2: Electric blue track jacket
  { top: '#0055ff', topAccent: '#00ccff', shirt: '#eee', tie: '#00ccff', pants: '#003399', shoes: '#0a0a0a', metalness: 0.3, emissive: '#001144' },
  // 3: Hot pink velvet
  { top: '#e91e8c', topAccent: '#ff69b4', shirt: '#1a1a1a', tie: '#ff69b4', pants: '#5a0a3a', shoes: '#111', metalness: 0.2, emissive: '#3a0520' },
  // 4: Lime green streetwear
  { top: '#44cc22', topAccent: '#88ff44', shirt: '#222', tie: '#88ff44', pants: '#1a3310', shoes: '#111', metalness: 0.15, emissive: '#0a2200' },
  // 5: Classic white tux
  { top: '#e8e8e8', topAccent: '#fff', shirt: '#111', tie: '#cc0000', pants: '#e0e0e0', shoes: '#1a1a1a', metalness: 0.3 },
  // 6: Red bomber
  { top: '#cc2222', topAccent: '#ff4444', shirt: '#f5f5f5', tie: '#222', pants: '#222', shoes: '#111', metalness: 0.2, emissive: '#220505' },
  // 7: Cyan cyberpunk
  { top: '#00bcd4', topAccent: '#00ffff', shirt: '#0a0a0a', tie: '#00ffff', pants: '#0a2a30', shoes: '#0a0a0a', metalness: 0.5, emissive: '#002a2a' },
  // 8: Orange flame
  { top: '#ff6600', topAccent: '#ffaa00', shirt: '#1a1a1a', tie: '#ffcc00', pants: '#3a1a00', shoes: '#1a1a1a', metalness: 0.2, emissive: '#1a0a00' },
];

// --- Eyewear ---
interface EyewearDef { type: string; color: string; frameColor: string }
const EYEWEAR: EyewearDef[] = [
  { type: 'aviator', color: '#111', frameColor: '#d4af37' },
  { type: 'round', color: '#442200', frameColor: '#d4af37' },
  { type: 'square', color: '#0a0a0a', frameColor: '#333' },
  { type: 'sport', color: '#0044cc', frameColor: '#222' },
  { type: 'visor-red', color: '#cc0000', frameColor: '#333' },
  { type: 'visor-gold', color: '#aa8800', frameColor: '#d4af37' },
  { type: 'tiny-round', color: '#111', frameColor: '#aaa' },
  { type: 'thug-life', color: '#050505', frameColor: '#111' },
  { type: 'none', color: '', frameColor: '' },
];

// --- Facial hair combos (mustache + beard together for coherent looks) ---
interface FacialHairDef { mustache: string; beard: string }
const FACIAL_HAIR: FacialHairDef[] = [
  { mustache: 'handlebar', beard: 'none' },
  { mustache: 'none', beard: 'full' },
  { mustache: 'chevron', beard: 'goatee' },
  { mustache: 'pencil', beard: 'none' },
  { mustache: 'none', beard: 'chinstrap' },
  { mustache: 'walrus', beard: 'stubble' },
  { mustache: 'none', beard: 'none' },
  { mustache: 'chevron', beard: 'full' },
  { mustache: 'handlebar', beard: 'stubble' },
];

// --- Accessory Components ---

const EyewearMesh: React.FC<{ def: EyewearDef }> = ({ def }) => {
  if (def.type === 'none') return null;

  // Aviators
  if (def.type === 'aviator') return (
    <group position={[0, 0.04, 0.2]}>
      <mesh><boxGeometry args={[0.05, 0.012, 0.012]} /><meshStandardMaterial color={def.frameColor} metalness={0.8} roughness={0.2} /></mesh>
      <mesh position={[-0.08, -0.008, 0]}><sphereGeometry args={[0.055, 8, 8]} /><meshStandardMaterial color={def.color} metalness={0.7} roughness={0.1} transparent opacity={0.85} /></mesh>
      <mesh position={[0.08, -0.008, 0]}><sphereGeometry args={[0.055, 8, 8]} /><meshStandardMaterial color={def.color} metalness={0.7} roughness={0.1} transparent opacity={0.85} /></mesh>
    </group>
  );

  // Round glasses
  if (def.type === 'round' || def.type === 'tiny-round') {
    const r = def.type === 'tiny-round' ? 0.035 : 0.045;
    return (
      <group position={[0, 0.04, 0.2]}>
        <mesh><boxGeometry args={[0.04, 0.01, 0.01]} /><meshStandardMaterial color={def.frameColor} metalness={0.8} roughness={0.2} /></mesh>
        <mesh position={[-0.07, 0, 0]}><torusGeometry args={[r, 0.006, 8, 16]} /><meshStandardMaterial color={def.frameColor} metalness={0.8} roughness={0.2} /></mesh>
        <mesh position={[0.07, 0, 0]}><torusGeometry args={[r, 0.006, 8, 16]} /><meshStandardMaterial color={def.frameColor} metalness={0.8} roughness={0.2} /></mesh>
        <mesh position={[-0.07, 0, 0.003]}><circleGeometry args={[r - 0.005, 16]} /><meshStandardMaterial color={def.color} transparent opacity={0.4} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0.07, 0, 0.003]}><circleGeometry args={[r - 0.005, 16]} /><meshStandardMaterial color={def.color} transparent opacity={0.4} side={THREE.DoubleSide} /></mesh>
      </group>
    );
  }

  // Square frames
  if (def.type === 'square') return (
    <group position={[0, 0.04, 0.2]}>
      <mesh><boxGeometry args={[0.03, 0.012, 0.012]} /><meshStandardMaterial color={def.frameColor} /></mesh>
      <mesh position={[-0.075, 0, 0]}><boxGeometry args={[0.09, 0.06, 0.012]} /><meshStandardMaterial color={def.color} metalness={0.6} roughness={0.15} transparent opacity={0.8} /></mesh>
      <mesh position={[0.075, 0, 0]}><boxGeometry args={[0.09, 0.06, 0.012]} /><meshStandardMaterial color={def.color} metalness={0.6} roughness={0.15} transparent opacity={0.8} /></mesh>
    </group>
  );

  // Visor / sport / thug-life — single wide bar
  return (
    <group position={[0, 0.04, 0.2]}>
      <mesh><boxGeometry args={[0.28, 0.06, 0.025]} /><meshStandardMaterial color={def.color} metalness={0.9} roughness={0.05} /></mesh>
    </group>
  );
};

const MustacheMesh: React.FC<{ type: string; color: string }> = ({ type, color }) => {
  if (type === 'none') return null;
  if (type === 'handlebar') return (
    <group position={[0, -0.06, 0.19]}>
      <mesh><boxGeometry args={[0.1, 0.02, 0.015]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
      <mesh position={[-0.06, 0.008, 0]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.03, 0.012, 0.012]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
      <mesh position={[0.06, 0.008, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.03, 0.012, 0.012]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
    </group>
  );
  if (type === 'pencil') return (
    <group position={[0, -0.06, 0.2]}><mesh><boxGeometry args={[0.08, 0.01, 0.008]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh></group>
  );
  if (type === 'walrus') return (
    <group position={[0, -0.065, 0.18]}>
      <mesh><boxGeometry args={[0.12, 0.035, 0.02]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
      <mesh position={[0, -0.012, 0.003]}><boxGeometry args={[0.08, 0.015, 0.015]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
    </group>
  );
  // chevron
  return (
    <group position={[0, -0.06, 0.19]}><mesh><boxGeometry args={[0.09, 0.025, 0.014]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh></group>
  );
};

const BeardMesh: React.FC<{ type: string; color: string }> = ({ type, color }) => {
  if (type === 'none') return null;
  if (type === 'full') return (
    <group position={[0, -0.12, 0.08]}>
      <mesh position={[0, 0, 0.05]}><sphereGeometry args={[0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh position={[-0.11, 0.05, 0.01]}><boxGeometry args={[0.035, 0.1, 0.05]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh position={[0.11, 0.05, 0.01]}><boxGeometry args={[0.035, 0.1, 0.05]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
    </group>
  );
  if (type === 'goatee') return (
    <group position={[0, -0.14, 0.15]}><mesh><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh></group>
  );
  if (type === 'chinstrap') return (
    <group position={[0, -0.1, 0.06]}>
      <mesh position={[0, -0.015, 0.07]}><boxGeometry args={[0.14, 0.02, 0.015]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh position={[-0.1, 0.035, 0.015]}><boxGeometry args={[0.02, 0.08, 0.025]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh position={[0.1, 0.035, 0.015]}><boxGeometry args={[0.02, 0.08, 0.025]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
    </group>
  );
  // stubble
  return (
    <group position={[0, -0.1, 0.12]}>
      <mesh><sphereGeometry args={[0.11, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} roughness={0.95} transparent opacity={0.3} /></mesh>
    </group>
  );
};

// --- Main Avatar ---

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, isUser, currentTurnIndex, audioListener }) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);

  // Deterministic look — seeded RNG from player ID gives unique sequence per player
  const look = useMemo(() => {
    const rng = seededRng(player.id);
    const skinIdx = rng() % SKIN_TONES.length;
    const hairIdx = rng() % HAIR_COLORS.length;
    const outfitIdx = rng() % OUTFITS.length;
    const eyewearIdx = rng() % EYEWEAR.length;
    const facialIdx = rng() % FACIAL_HAIR.length;
    return {
      skin: SKIN_TONES[skinIdx],
      hair: HAIR_COLORS[hairIdx],
      outfit: OUTFITS[outfitIdx],
      eyewear: EYEWEAR[eyewearIdx],
      facial: FACIAL_HAIR[facialIdx],
    };
  }, [player.id]);

  const nameTexture = useMemo(
    () => createTextTexture(player.name, '#ffffff', 32, 'rgba(0,0,0,0.7)', 256, 48),
    [player.name]
  );
  const chipsTexture = useMemo(
    () => createTextTexture(`$${player.chips}`, '#4ade80', 36, 'rgba(0,0,0,0.6)', 192, 48),
    [player.chips]
  );
  const emoteTexture = useMemo(
    () => player.emote ? createEmoteTexture(player.emote) : null,
    [player.emote]
  );
  const chatTexture = useMemo(
    () => player.chatMessage ? createTextTexture(player.chatMessage, '#4ade80', 24, 'rgba(0,0,0,0.85)', 512, 48) : null,
    [player.chatMessage]
  );

  useFrame((_, delta) => {
    if (!groupRef.current || isUser) return;
    groupRef.current.position.y = 0;
    groupRef.current.lookAt(0, 0, 0);
    if (headRef.current && player.lookYaw !== undefined && player.lookPitch !== undefined) {
      targetYaw.current = player.lookYaw;
      targetPitch.current = player.lookPitch;
      const ls = 8 * delta;
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetYaw.current, ls);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetPitch.current, ls);
    }
  });

  if (isUser) return null;

  const { skin, hair, outfit, eyewear, facial } = look;
  const f = player.isFolded;
  const jc = f ? '#333' : outfit.top;
  const pc = f ? '#2a2a2a' : outfit.pants;
  const sc = f ? '#222' : outfit.shoes;
  const tc = f ? '#222' : outfit.tie;
  const shc = f ? '#444' : outfit.shirt;
  const em = f ? undefined : outfit.emissive;
  const mt = f ? 0 : outfit.metalness;

  return (
    <group ref={groupRef} position={new THREE.Vector3(player.position[0], 0, player.position[2])}>

      {/* Shoes */}
      <mesh position={[-0.1, 0.035, 0.03]}><boxGeometry args={[0.12, 0.07, 0.22]} /><meshStandardMaterial color={sc} roughness={0.25} metalness={0.25} /></mesh>
      <mesh position={[0.1, 0.035, 0.03]}><boxGeometry args={[0.12, 0.07, 0.22]} /><meshStandardMaterial color={sc} roughness={0.25} metalness={0.25} /></mesh>

      {/* Legs — slim */}
      <mesh position={[-0.1, 0.4, 0]}><capsuleGeometry args={[0.06, 0.5, 6, 10]} /><meshStandardMaterial color={pc} roughness={0.7} /></mesh>
      <mesh position={[0.1, 0.4, 0]}><capsuleGeometry args={[0.06, 0.5, 6, 10]} /><meshStandardMaterial color={pc} roughness={0.7} /></mesh>

      {/* Torso — slim, athletic */}
      <mesh position={[0, 0.92, 0]}>
        <capsuleGeometry args={[0.16, 0.38, 8, 12]} />
        <meshStandardMaterial color={jc} roughness={0.45} metalness={mt} emissive={em} emissiveIntensity={em ? 0.3 : 0} />
      </mesh>

      {/* Accent stripe down jacket front */}
      {!f && (
        <mesh position={[0, 0.92, 0.14]}>
          <boxGeometry args={[0.03, 0.35, 0.01]} />
          <meshStandardMaterial color={outfit.topAccent} emissive={outfit.topAccent} emissiveIntensity={0.4} />
        </mesh>
      )}

      {/* Shoulders */}
      <mesh position={[-0.2, 1.05, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color={jc} roughness={0.45} metalness={mt} /></mesh>
      <mesh position={[0.2, 1.05, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color={jc} roughness={0.45} metalness={mt} /></mesh>

      {/* Arms — slim */}
      <mesh position={[-0.24, 0.82, 0.06]} rotation={[0.25, 0, 0.12]}>
        <capsuleGeometry args={[0.04, 0.38, 6, 8]} />
        <meshStandardMaterial color={jc} roughness={0.45} metalness={mt} />
      </mesh>
      <mesh position={[0.24, 0.82, 0.06]} rotation={[0.25, 0, -0.12]}>
        <capsuleGeometry args={[0.04, 0.38, 6, 8]} />
        <meshStandardMaterial color={jc} roughness={0.45} metalness={mt} />
      </mesh>

      {/* Hands */}
      <mesh position={[-0.26, 0.58, 0.16]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color={skin} roughness={0.6} /></mesh>
      <mesh position={[0.26, 0.58, 0.16]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color={skin} roughness={0.6} /></mesh>

      {/* Collar */}
      <mesh position={[0, 1.14, 0.1]}><boxGeometry args={[0.12, 0.05, 0.03]} /><meshStandardMaterial color={shc} /></mesh>

      {/* Tie/chain */}
      <mesh position={[0, 1.02, 0.14]}><boxGeometry args={[0.04, 0.16, 0.012]} /><meshStandardMaterial color={tc} roughness={0.4} metalness={0.3} /></mesh>

      {/* Neck */}
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.055, 0.06, 0.1, 8]} /><meshStandardMaterial color={skin} roughness={0.6} /></mesh>

      {/* === HEAD === */}
      <group ref={headRef} position={[0, 1.42, 0]}>
        <mesh><sphereGeometry args={[0.18, 16, 16]} /><meshStandardMaterial color={skin} roughness={0.5} /></mesh>

        {/* Hair */}
        <mesh position={[0, 0.05, -0.035]}>
          <sphereGeometry args={[0.185, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color={hair} roughness={0.85} />
        </mesh>

        {/* Ears */}
        <mesh position={[-0.18, -0.02, 0]}><sphereGeometry args={[0.035, 6, 6]} /><meshStandardMaterial color={skin} roughness={0.6} /></mesh>
        <mesh position={[0.18, -0.02, 0]}><sphereGeometry args={[0.035, 6, 6]} /><meshStandardMaterial color={skin} roughness={0.6} /></mesh>

        {/* Nose */}
        <mesh position={[0, -0.02, 0.18]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color={skin} roughness={0.6} /></mesh>

        {/* Eyes */}
        <mesh position={[-0.06, 0.035, 0.16]}><sphereGeometry args={[0.022, 8, 8]} /><meshStandardMaterial color="#f5f5f5" /></mesh>
        <mesh position={[0.06, 0.035, 0.16]}><sphereGeometry args={[0.022, 8, 8]} /><meshStandardMaterial color="#f5f5f5" /></mesh>
        <mesh position={[-0.06, 0.035, 0.182]}><sphereGeometry args={[0.011, 6, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        <mesh position={[0.06, 0.035, 0.182]}><sphereGeometry args={[0.011, 6, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>

        {/* Eyebrows */}
        <mesh position={[-0.06, 0.065, 0.17]} rotation={[0, 0, 0.1]}><boxGeometry args={[0.05, 0.01, 0.01]} /><meshStandardMaterial color={hair} /></mesh>
        <mesh position={[0.06, 0.065, 0.17]} rotation={[0, 0, -0.1]}><boxGeometry args={[0.05, 0.01, 0.01]} /><meshStandardMaterial color={hair} /></mesh>

        {/* Mouth */}
        <mesh position={[0, -0.085, 0.17]}><boxGeometry args={[0.05, 0.007, 0.008]} /><meshStandardMaterial color="#884444" /></mesh>

        {/* Accessories */}
        <EyewearMesh def={eyewear} />
        <MustacheMesh type={facial.mustache} color={hair} />
        <BeardMesh type={facial.beard} color={hair} />
      </group>

      {/* === OVERLAYS === */}
      <sprite position={[0, 2.15, 0]} scale={[2, 0.4, 1]}><spriteMaterial map={nameTexture} transparent depthTest={false} /></sprite>
      {player.isSpeaking && (<mesh position={[0, 2.45, 0]}><sphereGeometry args={[0.08, 8, 8]} /><meshBasicMaterial color="#4ade80" /></mesh>)}
      {!player.isFolded && chipsTexture && (<sprite position={[0, 1.85, 0]} scale={[1.5, 0.4, 1]}><spriteMaterial map={chipsTexture} transparent depthTest={false} /></sprite>)}
      {player.emote && emoteTexture && (<sprite position={[0, 2.8, 0]} scale={[0.8, 0.8, 1]}><spriteMaterial map={emoteTexture} transparent depthTest={false} /></sprite>)}
      {player.chatMessage && chatTexture && (<sprite position={[0, 2.6, 0]} scale={[3, 0.4, 1]}><spriteMaterial map={chatTexture} transparent depthTest={false} /></sprite>)}
    </group>
  );
};

export default PlayerAvatar;
