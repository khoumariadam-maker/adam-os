'use client';

// The 3D half of Breadboard.exe. Loaded on demand (next/dynamic) so three.js is only
// downloaded when someone opens the app. All state lives in BreadboardWindow; this file
// draws it and reports pointer events back.

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BOARD_D, BOARD_H, BOARD_W, holesOnNet, nearestHole, netOf } from '@/lib/circuit/board';
import {
  LED_FULL_BRIGHT,
  LED_HOT,
  LED_SPECS,
  LedColor,
  Part,
  WIRE_HEX,
  WireColor,
  resistorBands,
} from '@/lib/circuit/parts';
import type { SolveResult } from '@/lib/circuit/solver';
import { DESK_Y, METER, PROBE_H, V, batteryLeads, bodyShape, capShape, layoutOf, ledShape, meterJacks, partPath, pinPos, probeLead, resistorShape, wireCurve } from './geometry';
import { batteryLabel, boardTexture, drawLcd, glowTexture, lcdTexture, matTexture, smokeTexture } from './textures';

export type ViewMode = 'angle' | 'top';

export interface SceneProps {
  parts: Part[];
  result: SolveResult;
  ghost: { part: Part; valid: boolean } | null;
  pending: string | null;
  hover: string | null;
  hoverValid: boolean;
  selectedId: string | null;
  pressed: ReadonlySet<string>;
  showCurrent: boolean;
  view: ViewMode;
  viewNonce: number;
  pixel: boolean;
  burns: { id: string; at: number }[];
  interactive: 'select' | 'place' | 'delete';
  onHoverHole: (id: string | null, clientX: number, clientY: number) => void;
  onHoleClick: (id: string) => void;
  onPartClick: (id: string) => void;
  onPress: (id: string, down: boolean) => void;
  onToggleBattery: () => void;
  onKnob: (id: string, pos: number, phase: 'start' | 'move' | 'end') => void;
  onBackgroundClick: () => void;
}

// ---- shared materials -----------------------------------------------------------------------
const mats = {
  leg: new THREE.MeshStandardMaterial({ color: '#c9ced8', metalness: 0.85, roughness: 0.3 }),
  resBody: new THREE.MeshStandardMaterial({ color: '#dcc28e', roughness: 0.55 }),
  black: new THREE.MeshStandardMaterial({ color: '#1b1b20', roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: '#b8bcc6', metalness: 0.9, roughness: 0.25 }),
  copper: new THREE.MeshStandardMaterial({ color: '#c87533', metalness: 0.7, roughness: 0.35 }),
  white: new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.5 }),
  boardSide: new THREE.MeshStandardMaterial({ color: '#e9e3d4', roughness: 0.7 }),
  ghostOk: new THREE.MeshBasicMaterial({ color: '#4d8dff', transparent: true, opacity: 0.45, depthWrite: false }),
  ghostBad: new THREE.MeshBasicMaterial({ color: '#ff3a66', transparent: true, opacity: 0.45, depthWrite: false }),
};
const bandMats = new Map<string, THREE.MeshStandardMaterial>();
const bandMat = (hex: string) => {
  let m = bandMats.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: hex === '#c9a227' ? 0.6 : 0 });
    bandMats.set(hex, m);
  }
  return m;
};
const wireMats = new Map<string, THREE.MeshStandardMaterial>();
const wireMat = (c: WireColor) => {
  let m = wireMats.get(c);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: WIRE_HEX[c] ?? WIRE_HEX.red, roughness: 0.45 });
    wireMats.set(c, m);
  }
  return m;
};

let texCache: { board: THREE.Texture; mat: THREE.Texture; glow: THREE.Texture; smoke: THREE.Texture; label: THREE.Texture } | null = null;
const textures = () => (texCache ??= { board: boardTexture(), mat: matTexture(), glow: glowTexture(), smoke: smokeTexture(), label: batteryLabel() });

const Y_AXIS = new THREE.Vector3(0, 1, 0);
// Phones: cap resolution and shadow size so the GPU (and battery) aren't hammered.
const SMALL_SCREEN = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;

// A cylinder from a to b.
const Rod: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r?: number; material?: THREE.Material }> = ({ a, b, r = 0.06, material = mats.leg }) => {
  const { pos, quat, len } = useMemo(() => {
    const d = b.clone().sub(a);
    return {
      len: d.length(),
      pos: a.clone().add(b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d.clone().normalize()),
    };
  }, [a, b]);
  if (len < 1e-4) return null;
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow>
      <cylinderGeometry args={[r, r, len, 6]} />
    </mesh>
  );
};

// Turns everything inside it into a translucent, non-interactive preview.
const Ghost: React.FC<{ valid: boolean; children: React.ReactNode }> = ({ valid, children }) => {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh || (o as THREE.Sprite).isSprite) {
        if (m.isMesh) m.material = valid ? mats.ghostOk : mats.ghostBad;
        else o.visible = false;
        o.castShadow = false;
        o.raycast = () => undefined;
      }
    });
  });
  return <group ref={ref}>{children}</group>;
};

interface PartViewProps {
  part: Part;
  res?: SolveResult['parts'][string];
  selected: boolean;
  pressed: boolean;
  ghost?: boolean;
  handlers: {
    onClick?: (e: ThreeEvent<MouseEvent>) => void;
    onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
    onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  };
}

// ---- Resistor ---------------------------------------------------------------------------------
const Resistor: React.FC<PartViewProps> = ({ part, handlers }) => {
  const l = useMemo(() => layoutOf(part), [part]);
  const s = useMemo(() => resistorShape(l), [l]);
  const bands = resistorBands(part.ohms ?? 220);
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(Y_AXIS, s.vertical ? Y_AXIS : l.u),
    [s.vertical, l.u]
  );
  const offs = [-0.3, -0.13, 0.04, 0.3];
  return (
    <group {...handlers}>
      {s.legs.map(([a, b], i) => (
        <Rod key={i} a={a} b={b} />
      ))}
      <group position={s.bodyC} quaternion={quat}>
        <mesh material={mats.resBody} castShadow>
          <capsuleGeometry args={[0.3, s.len - 0.6, 4, 10]} />
        </mesh>
        {bands.map((hex, i) => (
          <mesh key={i} position={[0, offs[i] * s.len, 0]} material={bandMat(hex)}>
            <cylinderGeometry args={[0.315, 0.315, 0.13, 12]} />
          </mesh>
        ))}
        {/* fat hit area so the thin part is easy to tap */}
        <mesh visible={false}>
          <cylinderGeometry args={[0.6, 0.6, s.len + 0.4, 6]} />
        </mesh>
      </group>
    </group>
  );
};

// ---- LED -------------------------------------------------------------------------------------
const Led: React.FC<PartViewProps> = ({ part, res, handlers, ghost }) => {
  const l = useMemo(() => layoutOf(part), [part]);
  const s = useMemo(() => ledShape(l), [l]);
  const spec = LED_SPECS[(part.color as LedColor) ?? 'red'];
  const current = res?.on ? res.current : 0;
  const b = part.burnt ? 0 : Math.min(1.25, Math.sqrt(Math.max(0, current) / LED_FULL_BRIGHT));
  const hot = current > LED_HOT;
  const bodyRef = useRef<THREE.MeshStandardMaterial>(null);
  const domeRef = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const poolRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const flick = hot ? 0.75 + 0.25 * Math.sin(clock.elapsedTime * 40) : 1;
    const e = 0.04 + b * 2.2 * flick;
    if (bodyRef.current) bodyRef.current.emissiveIntensity = e;
    if (domeRef.current) domeRef.current.emissiveIntensity = e;
    if (glowRef.current) {
      const sc = 1.2 + 3.2 * b * flick;
      glowRef.current.scale.set(sc, sc, 1);
      (glowRef.current.material as THREE.SpriteMaterial).opacity = Math.min(1, b) * 0.9;
    }
    if (poolRef.current) {
      const sc = 3 + 5 * b;
      poolRef.current.scale.set(sc, sc, 1);
      (poolRef.current.material as THREE.MeshBasicMaterial).opacity = Math.min(1, b) * 0.55;
    }
  });
  const color = part.burnt ? '#3b3333' : spec.hex;
  const tex = textures();
  return (
    <group {...handlers}>
      {s.legs.map(([a, c], i) => (
        <Rod key={i} a={a} b={c} r={0.05} />
      ))}
      <group position={s.base}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.12, 18]} />
          <meshStandardMaterial ref={bodyRef} color={color} emissive={spec.hex} emissiveIntensity={0.04} transparent opacity={0.92} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.6, 18]} />
          <meshStandardMaterial ref={domeRef} color={color} emissive={spec.hex} emissiveIntensity={0.04} transparent opacity={0.88} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.72, 0]} castShadow>
          <sphereGeometry args={[0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} emissive={spec.hex} emissiveIntensity={0.04 + b * 2.2} transparent opacity={0.88} roughness={0.2} />
        </mesh>
        {/* the little anvil inside the lens */}
        <mesh position={[0, 0.4, 0]} material={mats.metal}>
          <boxGeometry args={[0.08, 0.5, 0.25]} />
        </mesh>
        {part.burnt && (
          <mesh position={[0, 1.15, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.dark}>
            <circleGeometry args={[0.28, 10]} />
          </mesh>
        )}
        <mesh visible={false}>
          <boxGeometry args={[1.4, 2.6, 1.4]} />
        </mesh>
        {!ghost && b > 0.01 && (
          <sprite ref={glowRef} position={[0, 0.75, 0]}>
            <spriteMaterial map={tex.glow} color={spec.glow} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
          </sprite>
        )}
      </group>
      {!ghost && b > 0.01 && (
        <mesh ref={poolRef} position={[l.mid.x, 0.015, l.mid.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex.glow} color={spec.glow} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

// ---- Push button -------------------------------------------------------------------------------
const Button: React.FC<PartViewProps> = ({ part, pressed, handlers }) => {
  const l = useMemo(() => layoutOf(part), [part]);
  const s = useMemo(() => bodyShape(l, 0.45), [l]);
  const capRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!capRef.current) return;
    const target = pressed ? 0.78 : 0.98;
    capRef.current.position.y += (target - capRef.current.position.y) * 0.45;
  });
  const w = Math.max(2.1, l.span + 0.5);
  return (
    <group {...handlers}>
      {s.legs.map(([a, b], i) => (
        <Rod key={i} a={a} b={b} r={0.07} />
      ))}
      <group position={[l.mid.x, 0, l.mid.z]} rotation={[0, l.angle, 0]}>
        <mesh position={[0, 0.37, 0]} material={mats.black} castShadow receiveShadow>
          <boxGeometry args={[w, 0.7, 2.1]} />
        </mesh>
        <mesh position={[0, 0.73, 0]} material={mats.metal}>
          <boxGeometry args={[w - 0.2, 0.04, 1.9]} />
        </mesh>
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.35), 0.78, sz * 0.7]} material={mats.black}>
              <cylinderGeometry args={[0.12, 0.12, 0.08, 8]} />
            </mesh>
          ))
        )}
        <mesh ref={capRef} position={[0, pressed ? 0.78 : 0.98, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.66, 0.5, 20]} />
          <meshStandardMaterial color={pressed ? '#ff5560' : '#e8242c'} roughness={0.4} />
        </mesh>
        <mesh visible={false} position={[0, 0.6, 0]}>
          <boxGeometry args={[w + 0.4, 1.6, 2.5]} />
        </mesh>
      </group>
    </group>
  );
};

// ---- Buzzer ----------------------------------------------------------------------------------
const Buzzer: React.FC<PartViewProps> = ({ part, res, handlers, ghost }) => {
  const l = useMemo(() => layoutOf(part), [part]);
  const s = useMemo(() => bodyShape(l, 0.55), [l]);
  const on = !!res?.on && !ghost;
  const body = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (body.current) {
      body.current.position.x = on ? Math.sin(t * 90) * 0.025 : 0;
      body.current.position.z = on ? Math.cos(t * 77) * 0.025 : 0;
    }
    if (rings.current) {
      rings.current.visible = on;
      rings.current.children.forEach((r, i) => {
        const k = (t * 1.6 + i / 3) % 1;
        r.position.y = 1.15 + k * 1.6;
        r.scale.setScalar(0.5 + k * 1.6);
        ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7;
      });
    }
  });
  return (
    <group {...handlers}>
      {s.legs.map(([a, b], i) => (
        <Rod key={i} a={a} b={b} r={0.06} />
      ))}
      <group position={[l.mid.x, 0, l.mid.z]} rotation={[0, l.angle, 0]}>
        <group ref={body}>
          <mesh position={[0, 0.6, 0]} material={mats.black} castShadow receiveShadow>
            <cylinderGeometry args={[1.15, 1.15, 0.95, 28]} />
          </mesh>
          <mesh position={[0, 1.08, 0]} material={mats.dark}>
            <cylinderGeometry args={[0.22, 0.22, 0.02, 14]} />
          </mesh>
          {/* "+" marking on the positive side */}
          <mesh position={[-0.68, 1.085, 0]} material={mats.white}>
            <boxGeometry args={[0.32, 0.01, 0.08]} />
          </mesh>
          <mesh position={[-0.68, 1.085, 0]} material={mats.white}>
            <boxGeometry args={[0.08, 0.01, 0.32]} />
          </mesh>
        </group>
        <group ref={rings} visible={false}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
              <ringGeometry args={[0.55, 0.62, 28]} />
              <meshBasicMaterial color="#ffe55c" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};

// ---- Jumper wire ---------------------------------------------------------------------------------
const Wire: React.FC<PartViewProps> = ({ part, handlers }) => {
  const l = useMemo(() => layoutOf(part), [part]);
  const geo = useMemo(() => new THREE.TubeGeometry(wireCurve(l), Math.max(16, Math.round(l.span * 4)), 0.12, 8, false), [l]);
  const hit = useMemo(() => new THREE.TubeGeometry(wireCurve(l), 12, 0.4, 5, false), [l]);
  useEffect(() => () => {
    geo.dispose();
    hit.dispose();
  }, [geo, hit]);
  return (
    <group {...handlers}>
      <mesh geometry={geo} material={wireMat((part.color as WireColor) ?? 'red')} castShadow />
      <mesh geometry={hit} visible={false} />
      {[l.p0, l.p1].map((p, i) => (
        <mesh key={i} position={[p.x, 0.12, p.z]} material={mats.metal}>
          <cylinderGeometry args={[0.15, 0.15, 0.25, 8]} />
        </mesh>
      ))}
    </group>
  );
};

// ---- Battery -------------------------------------------------------------------------------------
const Battery: React.FC<PartViewProps & { short: boolean; onToggle: () => void }> = ({ part, handlers, short, onToggle }) => {
  const { plus, minus, box, sPlus, sMinus } = useMemo(() => batteryLeads(part), [part]);
  const plusGeo = useMemo(() => new THREE.TubeGeometry(plus, 40, 0.11, 8, false), [plus]);
  const minusGeo = useMemo(() => new THREE.TubeGeometry(minus, 40, 0.11, 8, false), [minus]);
  useEffect(() => () => {
    plusGeo.dispose();
    minusGeo.dispose();
  }, [plusGeo, minusGeo]);
  const heat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (heat.current) heat.current.emissiveIntensity = short ? 0.4 + 0.35 * Math.sin(clock.elapsedTime * 8) : 0;
  });
  const on = part.on !== false;
  const type = part.battery ?? '9v';
  const tex = textures();
  const knobX = on ? 0.32 : -0.32;
  const top = box.c.y + box.size.y / 2;
  return (
    <group>
      <group {...handlers}>
        <mesh geometry={plusGeo} material={wireMat('red')} castShadow />
        <mesh geometry={minusGeo} material={wireMat('black')} castShadow />
        {type === '9v' ? (
          <>
            <mesh position={box.c} castShadow receiveShadow>
              <boxGeometry args={[box.size.x, box.size.y, box.size.z]} />
              <meshStandardMaterial ref={heat} map={tex.label} emissive="#ff2000" emissiveIntensity={0} roughness={0.5} />
            </mesh>
            {/* snap connector */}
            <mesh position={[box.c.x, box.c.y + 0.2, box.front + 0.28]} material={mats.black} castShadow>
              <boxGeometry args={[2.0, 1.0, 0.56]} />
            </mesh>
          </>
        ) : (
          <>
            <mesh position={[box.c.x, box.c.y - box.size.y / 2 + 0.3, box.c.z]} castShadow receiveShadow>
              <boxGeometry args={[box.size.x, 0.6, box.size.z]} />
              <meshStandardMaterial ref={heat} color="#1b1b20" emissive="#ff2000" emissiveIntensity={0} roughness={0.6} />
            </mesh>
            {Array.from({ length: box.cells ?? 2 }, (_, i) => {
              const x = box.c.x - ((box.cells ?? 2) - 1) * 0.56 + i * 1.12;
              const flip = i % 2 === 1;
              return (
                <group key={i} position={[x, box.c.y + 0.05, box.c.z]} rotation={[Math.PI / 2, 0, 0]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.5, 0.5, 5.0, 18]} />
                    <meshStandardMaterial color={i % 2 ? '#2a5bd7' : '#1f1f24'} roughness={0.35} metalness={0.2} />
                  </mesh>
                  <mesh position={[0, flip ? -2.6 : 2.6, 0]} material={mats.copper}>
                    <cylinderGeometry args={[0.2, 0.2, 0.2, 10]} />
                  </mesh>
                </group>
              );
            })}
          </>
        )}
        <mesh position={sPlus} material={mats.black}>
          <sphereGeometry args={[0.16, 8, 6]} />
        </mesh>
        <mesh position={sMinus} material={mats.black}>
          <sphereGeometry args={[0.16, 8, 6]} />
        </mesh>
      </group>
      {/* power switch */}
      <group
        position={[box.c.x, top + (type === '9v' ? 0 : -0.05), box.c.z - box.size.z / 2 + 1.0]}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta < 8) onToggle();
        }}
      >
        <mesh position={[0, 0.1, 0]} material={mats.white} castShadow>
          <boxGeometry args={[1.5, 0.2, 0.8]} />
        </mesh>
        <mesh position={[knobX, 0.32, 0]} castShadow>
          <boxGeometry args={[0.6, 0.3, 0.55]} />
          <meshStandardMaterial color={on ? '#22b14c' : '#6a6a72'} emissive={on ? '#22b14c' : '#000000'} emissiveIntensity={on ? 0.5 : 0} />
        </mesh>
        <mesh visible={false}>
          <boxGeometry args={[2, 1.2, 1.4]} />
        </mesh>
      </group>
    </group>
  );
};


// ---- Potentiometer (trimmer style, drag the knob to turn it) ----------------------------------------------
const Pot: React.FC<PartViewProps> = ({ part, handlers }) => {
  const l = useMemo(() => layoutOf(part), [part]);
  const s = useMemo(() => bodyShape(l, 0.5), [l]);
  const knob = useRef<THREE.Group>(null);
  const target = (-0.75 + 1.5 * (part.pos ?? 0.5)) * Math.PI;
  useFrame(() => {
    if (knob.current) knob.current.rotation.y += (-target - knob.current.rotation.y) * 0.35;
  });
  return (
    <group {...handlers}>
      {s.legs.map(([a, b], i) => (
        <Rod key={i} a={a} b={b} r={0.07} />
      ))}
      <group position={[l.mid.x, 0, l.mid.z]} rotation={[0, l.angle, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(2.0, l.span + 0.4), 0.9, 2.0]} />
          <meshStandardMaterial color="#2c62d8" roughness={0.45} />
        </mesh>
        <group ref={knob} position={[0, 0.95, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.75, 0.8, 0.5, 24]} />
            <meshStandardMaterial color="#f1ede2" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.27, -0.38]} material={mats.dark}>
            <boxGeometry args={[0.14, 0.04, 0.62]} />
          </mesh>
        </group>
        {/* tick marks for the knob's range */}
        {[-0.75, -0.375, 0, 0.375, 0.75].map((k, i) => (
          <mesh key={i} position={[Math.sin(k * Math.PI) * -0.92, 0.96, Math.cos(k * Math.PI) * -0.92]} rotation={[0, -k * Math.PI, 0]} material={mats.white}>
            <boxGeometry args={[0.05, 0.02, 0.16]} />
          </mesh>
        ))}
        <mesh visible={false} position={[0, 0.7, 0]}>
          <boxGeometry args={[2.4, 1.6, 2.4]} />
        </mesh>
      </group>
    </group>
  );
};

// ---- Electrolytic capacitor -----------------------------------------------------------------------------------
const Cap: React.FC<PartViewProps> = ({ part, res, handlers, ghost }) => {
  const l = useMemo(() => layoutOf(part), [part]);
  const s = useMemo(() => capShape(part, l), [part, l]);
  const charge = ghost ? 0 : Math.min(1, Math.abs(res?.drop ?? 0) / 9);
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (ring.current) ring.current.emissiveIntensity = 0.1 + charge * 2.2;
  });
  const vented = !!part.burnt;
  return (
    <group {...handlers}>
      {s.legs.map(([a, b], i) => (
        <Rod key={i} a={a} b={b} r={0.05} />
      ))}
      <group position={s.base} rotation={[0, l.angle, 0]}>
        <mesh position={[0, s.h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[s.r, s.r, s.h, 24]} />
          <meshStandardMaterial color={vented ? '#3a3236' : '#1f3c8c'} roughness={0.35} metalness={0.15} />
        </mesh>
        {/* light stripe marks the − leg */}
        <mesh position={[s.r * 0.72, s.h / 2, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[s.r * 0.32, s.r * 0.32, s.h * 0.98, 10, 1, false]} />
          <meshStandardMaterial color={vented ? '#5a5258' : '#c9d6f5'} roughness={0.4} />
        </mesh>
        <mesh position={[0, s.h + (vented ? 0.12 : 0.01), 0]} material={mats.metal} scale={[1, vented ? 3 : 1, 1]}>
          <cylinderGeometry args={[s.r * 0.94, s.r * 0.94, 0.04, 24]} />
        </mesh>
        {/* charge ring: glows brighter the more charge it holds */}
        <mesh position={[0, s.h + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
          <ringGeometry args={[s.r * 0.55, s.r * 0.78, 24]} />
          <meshStandardMaterial ref={ring} color="#ffe55c" emissive="#ffd21f" emissiveIntensity={0.1} toneMapped={false} />
        </mesh>
        <mesh visible={false} position={[0, s.h / 2, 0]}>
          <cylinderGeometry args={[s.r + 0.4, s.r + 0.4, s.h + 0.6, 8]} />
        </mesh>
      </group>
    </group>
  );
};

// ---- Multimeter with probes -------------------------------------------------------------------------------------
const formatReading = (v: number) => {
  const a = Math.abs(v);
  if (a >= 100) return 'OL';
  const t = a.toFixed(2);
  return v < -0.005 ? `-${t}` : t;
};
const Meter: React.FC<PartViewProps> = ({ part, res, handlers, ghost }) => {
  const jacks = useMemo(() => meterJacks(), []);
  const leads = useMemo(() => [probeLead(jacks.red, part.pins[0]), probeLead(jacks.black, part.pins[1])], [jacks, part.pins]);
  const geos = useMemo(() => leads.map((c) => new THREE.TubeGeometry(c, 40, 0.08, 6, false)), [leads]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  const lcd = useMemo(() => lcdTexture(), []);
  useEffect(() => () => lcd.texture.dispose(), [lcd]);
  const reading = formatReading(res?.drop ?? 0);
  useEffect(() => {
    drawLcd(lcd.canvas, reading, 'V');
    lcd.texture.needsUpdate = true;
  }, [reading, lcd]);
  const { c, size } = METER;
  const top = c.y + size.y / 2;
  return (
    <group {...handlers}>
      {!ghost && (
        <group>
          <mesh position={c} castShadow receiveShadow>
            <boxGeometry args={[size.x, size.y, size.z]} />
            <meshStandardMaterial color="#f2c21b" roughness={0.7} />
          </mesh>
          <mesh position={[c.x, top + 0.01, c.z]}>
            <boxGeometry args={[size.x - 0.5, 0.04, size.z - 0.5]} />
            <meshStandardMaterial color="#26262c" roughness={0.6} />
          </mesh>
          <mesh position={[c.x, top + 0.04, c.z - size.z / 2 + 1.25]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[size.x - 1.0, 1.4]} />
            <meshBasicMaterial map={lcd.texture} toneMapped={false} />
          </mesh>
          <group position={[c.x, top + 0.2, c.z + 0.45]}>
            <mesh castShadow>
              <cylinderGeometry args={[1.0, 1.05, 0.35, 28]} />
              <meshStandardMaterial color="#3a3a42" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.2, -0.55]} rotation={[0, 0, 0]} material={mats.white}>
              <boxGeometry args={[0.16, 0.05, 0.8]} />
            </mesh>
          </group>
          {[jacks.red, jacks.black].map((j, i) => (
            <mesh key={i} position={j}>
              <cylinderGeometry args={[0.24, 0.24, 0.12, 14]} />
              <meshStandardMaterial color={i === 0 ? '#e0242c' : '#18181c'} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={wireMat(i === 0 ? 'red' : 'black')} castShadow />
      ))}
      {part.pins.map((h, i) => {
        const p = pinPos(h);
        return (
          <group key={h + i} position={[p.x, 0, p.z]}>
            <mesh position={[0, 0.3, 0]} material={mats.metal}>
              <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
            </mesh>
            <mesh position={[0, 0.65 + (PROBE_H - 0.6) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.14, PROBE_H - 0.6, 12]} />
              <meshStandardMaterial color={i === 0 ? '#e0242c' : '#202024'} roughness={0.45} />
            </mesh>
            <mesh visible={false} position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.5, 0.5, 2.6, 6]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const VIEWS: Record<string, React.FC<any>> = { resistor: Resistor, led: Led, button: Button, buzzer: Buzzer, wire: Wire, pot: Pot, cap: Cap, meter: Meter };

// ---- Flowing current ----------------------------------------------------------------------------------
const MAX_DOTS = 900;
const Current: React.FC<{ parts: Part[]; result: SolveResult }> = ({ parts, result }) => {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // Paths only change with the parts; speeds change with every solve (capacitors update each frame).
  const paths = useMemo(() => {
    const out = new Map<string, { pts: THREE.Vector3[]; cum: number[]; len: number }>();
    for (const p of parts) {
      if (p.kind === 'meter') continue;
      const pts = partPath(p).map((v) => v.clone().add(V(0, 0.02, 0)));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      out.set(p.id, { pts, cum, len: cum[cum.length - 1] });
    }
    return out;
  }, [parts]);
  const flows = useMemo(() => {
    const out: { pts: THREE.Vector3[]; cum: number[]; len: number; speed: number }[] = [];
    paths.forEach((path, id) => {
      const r = result.parts[id];
      if (!r || Math.abs(r.current) < 2e-4) return;
      const mA = Math.abs(r.current) * 1000;
      out.push({ ...path, speed: Math.sign(r.current) * (0.8 + 1.5 * Math.log10(1 + mA)) });
    });
    return out;
  }, [paths, result]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const SP = 0.8;
    let n = 0;
    for (const f of flows) {
      const phase = (((t * f.speed) % SP) + SP) % SP;
      let seg = 0;
      for (let d = phase; d < f.len && n < MAX_DOTS; d += SP) {
        while (seg < f.cum.length - 2 && f.cum[seg + 1] < d) seg++;
        const a = f.pts[seg];
        const b = f.pts[seg + 1];
        const segLen = f.cum[seg + 1] - f.cum[seg] || 1;
        tmp.position.lerpVectors(a, b, (d - f.cum[seg]) / segLen);
        tmp.updateMatrix();
        m.setMatrixAt(n++, tmp.matrix);
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_DOTS]} raycast={() => undefined} frustumCulled={false}>
      <sphereGeometry args={[0.13, 8, 6]} />
      <meshBasicMaterial color="#fff27a" toneMapped={false} />
    </instancedMesh>
  );
};

// ---- Smoke puffs when an LED burns out -----------------------------------------------------------------
const Smoke: React.FC<{ at: number; pos: THREE.Vector3 }> = ({ at, pos }) => {
  const group = useRef<THREE.Group>(null);
  const seeds = useMemo(() => Array.from({ length: 9 }, () => [Math.random() - 0.5, Math.random() - 0.5, 0.6 + Math.random() * 0.8]), []);
  const tex = textures();
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const age = (performance.now() - at) / 1000;
    g.children.forEach((c, i) => {
      const s = c as THREE.Sprite;
      const mat = s.material as THREE.SpriteMaterial;
      if (i === 0) {
        // flash
        const k = Math.max(0, 1 - age / 0.18);
        s.scale.setScalar(0.5 + 3 * (1 - k));
        mat.opacity = k;
        return;
      }
      const [dx, dz, sp] = seeds[i - 1];
      const k = Math.max(0, age - (i - 1) * 0.07);
      s.position.set(dx * k * 1.4, k * 2.2 * sp, dz * k * 1.4);
      s.scale.setScalar(0.4 + k * 1.5);
      mat.opacity = Math.max(0, 0.75 - k / 2.4);
    });
  });
  return (
    <group ref={group} position={pos}>
      <sprite>
        <spriteMaterial map={tex.glow} color="#fff6c8" blending={THREE.AdditiveBlending} transparent depthWrite={false} />
      </sprite>
      {seeds.map((_, i) => (
        <sprite key={i}>
          <spriteMaterial map={tex.smoke} color="#6b6b70" transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  );
};

// ---- Board, desk and hover markers -------------------------------------------------------------------
const Board: React.FC<{
  interactive: SceneProps['interactive'];
  onHoverHole: SceneProps['onHoverHole'];
  onHoleClick: SceneProps['onHoleClick'];
  onBackgroundClick: SceneProps['onBackgroundClick'];
}> = ({ onHoverHole, onHoleClick, onBackgroundClick }) => {
  const tex = textures();
  return (
    <group>
      <mesh position={[0, -BOARD_H / 2, 0]} material={mats.boardSide} castShadow receiveShadow>
        <boxGeometry args={[BOARD_W, BOARD_H, BOARD_D]} />
      </mesh>
      <mesh
        position={[0, 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerMove={(e) => {
          const h = nearestHole(e.point.x, e.point.z);
          onHoverHole(h?.id ?? null, e.nativeEvent.clientX, e.nativeEvent.clientY);
        }}
        onPointerOut={(e) => {
          onHoverHole(null, e.nativeEvent.clientX, e.nativeEvent.clientY);
        }}
        onClick={(e) => {
          if (e.delta > 8) return;
          const h = nearestHole(e.point.x, e.point.z, 0.7);
          if (h) {
            onHoverHole(h.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
            onHoleClick(h.id);
          } else onBackgroundClick();
        }}
      >
        <planeGeometry args={[BOARD_W, BOARD_D]} />
        <meshStandardMaterial map={tex.board} roughness={0.75} />
      </mesh>
      {/* cutting mat */}
      <mesh
        position={[0, DESK_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          if (e.delta <= 8 && e.object === e.eventObject) onBackgroundClick();
        }}
      >
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial map={tex.mat} roughness={0.95} />
      </mesh>
    </group>
  );
};

const Markers: React.FC<{ hover: string | null; hoverValid: boolean; pending: string | null; selectedPins: string[] }> = ({
  hover,
  hoverValid,
  pending,
  selectedPins,
}) => {
  const strip = useMemo(() => {
    if (!hover) return null;
    const holes = holesOnNet(netOf(hover));
    if (holes.length < 2) return null;
    const xs = holes.map((h) => h.x);
    const zs = holes.map((h) => h.z);
    const minX = Math.min(...xs) - 0.42;
    const maxX = Math.max(...xs) + 0.42;
    const minZ = Math.min(...zs) - 0.42;
    const maxZ = Math.max(...zs) + 0.42;
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ };
  }, [hover]);
  const ring = (id: string, color: string, key: string, size = 0.62) => {
    const p = pinPos(id);
    return (
      <mesh key={key} position={[p.x, 0.02, p.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
        <ringGeometry args={[size * 0.55, size * 0.8, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </mesh>
    );
  };
  return (
    <group>
      {strip && (
        <mesh position={[strip.x, 0.012, strip.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
          <planeGeometry args={[strip.w, strip.d]} />
          <meshBasicMaterial color={hoverValid ? '#4d8dff' : '#ff3a66'} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
      {hover && ring(hover, hoverValid ? '#2a6cff' : '#ff3a66', 'hover')}
      {pending && ring(pending, '#ffb800', 'pending', 0.75)}
      {selectedPins.map((id, i) => ring(id, '#00c2ff', `sel${i}`, 0.8))}
    </group>
  );
};

// ---- Camera: orbit controls plus animated "fly to" for the view buttons -----------------------------------
const FOV = 38;
const CameraRig: React.FC<{ view: ViewMode; nonce: number; pressing: React.MutableRefObject<boolean> }> = ({ view, nonce, pressing }) => {
  const { camera, gl, size } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const fly = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t0: number; tFrom: THREE.Vector3; tTo: THREE.Vector3 } | null>(null);
  const aspect = size.width / Math.max(1, size.height);
  // Tall screens (phones held upright) look along the board's length so it fills the screen.
  const portrait = aspect < 0.9;

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.minDistance = 8;
    c.maxDistance = 110;
    c.maxPolarAngle = 1.32;
    c.zoomSpeed = 0.8;
    controls.current = c;
    return () => c.dispose();
  }, [camera, gl]);

  // Camera distance that fits the board (plus battery) for this aspect ratio.
  const goal = () => {
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const target = portrait ? V(-1, 0, -1.6) : V(-1.2, 0, -1.4);
    const [halfAcross, halfDown] = portrait ? [12.5, 18] : [18, 15.5];
    const d = Math.max(halfDown / t, halfAcross / (t * aspect));
    const top = view === 'top';
    const off = portrait
      ? top
        ? V(0.01, d, 0)
        : V(0.72, 0.69, 0).multiplyScalar(d * 1.1)
      : top
      ? V(0, d, 0.01)
      : V(0, 0.69, 0.72).multiplyScalar(d * 0.8);
    return { pos: target.clone().add(off), target };
  };

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const top = view === 'top';
    c.enableRotate = !top;
    c.mouseButtons = { LEFT: top ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: top ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    const g = goal();
    if (!fly.current && camera.userData.placed !== true) {
      // First frame: jump straight there.
      camera.userData.placed = true;
      camera.position.copy(g.pos);
      c.target.copy(g.target);
      c.update();
      return;
    }
    fly.current = { from: camera.position.clone(), to: g.pos, t0: performance.now(), tFrom: c.target.clone(), tTo: g.target };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, nonce, portrait]);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    c.enabled = !pressing.current;
    const f = fly.current;
    if (f) {
      const k = Math.min(1, (performance.now() - f.t0) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(f.from, f.to, e);
      c.target.lerpVectors(f.tFrom, f.tTo, e);
      if (k >= 1) fly.current = null;
    }
    c.update();
  });
  return null;
};

const Background: React.FC = () => {
  const { scene } = useThree();
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--c-base').trim();
    const parts = raw.split(/[\s,]+/).map(Number);
    const col = parts.length >= 3 && parts.every((n) => !Number.isNaN(n)) ? new THREE.Color(parts[0] / 255, parts[1] / 255, parts[2] / 255) : new THREE.Color('#0d1030');
    col.convertSRGBToLinear();
    scene.background = col;
    scene.fog = new THREE.Fog(col, 90, 190);
  }, [scene]);
  return null;
};

// ---- Scene root ------------------------------------------------------------------------------------------------
const World: React.FC<SceneProps & { pressing: React.MutableRefObject<boolean> }> = (props) => {
  const { parts, result, ghost, selectedId, pressed, showCurrent, burns, interactive, pressing } = props;
  const selected = parts.find((p) => p.id === selectedId);
  const now = performance.now();

  const handlersFor = (p: Part) => ({
    // Over a part (outside placement) hide the hole probe and show a hand cursor.
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (interactive === 'place') return;
      e.stopPropagation();
      props.onHoverHole(null, e.nativeEvent.clientX, e.nativeEvent.clientY);
      (e.nativeEvent.target as HTMLElement).style.cursor = 'pointer';
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      (e.nativeEvent.target as HTMLElement).style.cursor = '';
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (interactive === 'place' || e.delta > 8) return;
      e.stopPropagation();
      props.onPartClick(p.id);
    },
    onPointerDown:
      p.kind === 'pot' && interactive === 'select'
        ? (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            pressing.current = true;
            const x0 = e.nativeEvent.clientX;
            const y0 = e.nativeEvent.clientY;
            const start = p.pos ?? 0.5;
            let moved = false;
            props.onKnob(p.id, start, 'start');
            const move = (ev: PointerEvent) => {
              const d = (ev.clientX - x0 - (ev.clientY - y0)) / 160;
              if (Math.abs(d) > 0.02) moved = true;
              if (moved) props.onKnob(p.id, Math.min(1, Math.max(0, start + d)), 'move');
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              window.removeEventListener('pointercancel', up);
              props.onKnob(p.id, start, 'end');
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
            window.addEventListener('pointercancel', up);
          }
        : p.kind === 'button' && interactive !== 'delete'
        ? (e: ThreeEvent<PointerEvent>) => {
            if (interactive === 'place') return;
            e.stopPropagation();
            pressing.current = true;
            props.onPress(p.id, true);
          }
        : undefined,
  });

  return (
    <>
      <Background />
      <hemisphereLight args={['#e3ebff', '#3b3346', 0.85]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[12, 30, 16]}
        intensity={1.9}
        castShadow
        shadow-mapSize={SMALL_SCREEN ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
      />
      <Board interactive={interactive} onHoverHole={props.onHoverHole} onHoleClick={props.onHoleClick} onBackgroundClick={props.onBackgroundClick} />
      <Markers hover={props.hover} hoverValid={props.hoverValid} pending={props.pending} selectedPins={selected ? selected.pins : []} />
      {parts.map((p) => {
        const common = { part: p, res: result.parts[p.id], selected: p.id === selectedId, pressed: pressed.has(p.id), handlers: handlersFor(p) };
        if (p.kind === 'battery') return <Battery key={p.id} {...common} short={result.short} onToggle={props.onToggleBattery} />;
        const View = VIEWS[p.kind];
        return View ? <View key={p.id} {...common} /> : null;
      })}
      {ghost && (
        <Ghost valid={ghost.valid}>
          {(() => {
            const View = VIEWS[ghost.part.kind];
            return View ? <View part={ghost.part} selected={false} pressed={false} ghost handlers={{}} /> : null;
          })()}
        </Ghost>
      )}
      {showCurrent && <Current parts={parts} result={result} />}
      {burns
        .filter((b) => now - b.at < 3000)
        .map((b) => {
          const p = parts.find((q) => q.id === b.id);
          if (!p) return null;
          const pos = p.kind === 'cap' ? capShape(p, layoutOf(p)).top : ledShape(layoutOf(p)).top;
          return <Smoke key={`${b.id}-${b.at}`} at={b.at} pos={pos} />;
        })}
      <CameraRig view={props.view} nonce={props.viewNonce} pressing={pressing} />
    </>
  );
};

export default function BreadboardScene(props: SceneProps) {
  const pressing = useRef(false);
  useEffect(() => {
    const up = () => {
      pressing.current = false;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);
  return (
    <Canvas
      shadows
      dpr={props.pixel ? 0.4 : [1, SMALL_SCREEN ? 1.5 : 2]}
      camera={{ fov: FOV, near: 0.5, far: 400, position: [0, 30, 30] }}
      gl={{ antialias: !props.pixel, powerPreference: 'high-performance' }}
      style={{ imageRendering: props.pixel ? 'pixelated' : 'auto', touchAction: 'none' }}
      onPointerMissed={(e) => {
        if (e.type === 'click') props.onBackgroundClick();
      }}
    >
      <World {...props} pressing={pressing} />
    </Canvas>
  );
}

