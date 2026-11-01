// Where each part sits in 3D: pin positions, body placement and the path current takes
// through it (used by the flowing-current dots). Units are hole pitches; the board's top
// surface is y = 0 and the desk is y = −BOARD_H.

import * as THREE from 'three';
import { BOARD_H, getHole } from '@/lib/circuit/board';
import type { BatteryType, Part } from '@/lib/circuit/parts';

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const pinPos = (id: string) => {
  const h = getHole(id);
  return h ? V(h.x, 0, h.z) : V(0, 0, 0);
};

export interface Layout {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  mid: THREE.Vector3;
  u: THREE.Vector3; // unit direction p0 -> p1 on the board plane
  span: number;
  angle: number; // rotation about Y that turns local +x into u
}

export const layoutOf = (p: Part): Layout => {
  const p0 = pinPos(p.pins[0]);
  const p1 = pinPos(p.pins[1]);
  const d = p1.clone().sub(p0);
  const span = d.length();
  const u = span > 1e-6 ? d.clone().divideScalar(span) : V(1, 0, 0);
  return { p0, p1, mid: p0.clone().add(p1).multiplyScalar(0.5), u, span, angle: Math.atan2(-u.z, u.x) };
};

// ---- Resistor ---------------------------------------------------------------------------
export const RES_H = 0.55;
export const resistorShape = (l: Layout) => {
  const vertical = l.span < 1.7;
  if (vertical) {
    // Too short to lie flat: stand it up on the first leg and loop the second leg over.
    const bodyC = l.p0.clone().add(V(0, 1.45, 0));
    const a = l.p0.clone().add(V(0, 2.8, 0));
    const b = l.p1.clone().add(V(0, 2.8, 0));
    return {
      vertical,
      bodyC,
      len: 1.9,
      legs: [
        [l.p0, l.p0.clone().add(V(0, 0.6, 0))],
        [l.p0.clone().add(V(0, 2.3, 0)), a],
        [a, b],
        [b, l.p1],
      ] as [THREE.Vector3, THREE.Vector3][],
      path: [l.p0, a, b, l.p1],
    };
  }
  const len = Math.min(2.4, Math.max(1.1, l.span - 1.0));
  const bodyC = l.mid.clone().add(V(0, RES_H, 0));
  const e0 = bodyC.clone().addScaledVector(l.u, -len / 2);
  const e1 = bodyC.clone().addScaledVector(l.u, len / 2);
  const k0 = l.p0.clone().add(V(0, RES_H, 0));
  const k1 = l.p1.clone().add(V(0, RES_H, 0));
  return {
    vertical,
    bodyC,
    len,
    legs: [
      [l.p0, k0],
      [k0, e0],
      [l.p1, k1],
      [k1, e1],
    ] as [THREE.Vector3, THREE.Vector3][],
    path: [l.p0, k0, e0, e1, k1, l.p1],
  };
};

// ---- LED --------------------------------------------------------------------------------
export const LED_BASE = 1.05;
export const ledShape = (l: Layout) => {
  const c = l.mid.clone().add(V(0, LED_BASE, 0));
  const half = Math.min(0.24, l.span / 2);
  const t0 = c.clone().addScaledVector(l.u, -half);
  const t1 = c.clone().addScaledVector(l.u, half);
  const k0 = l.p0.clone().add(V(0, 0.35, 0));
  const k1 = l.p1.clone().add(V(0, 0.35, 0));
  return {
    base: c,
    top: c.clone().add(V(0, 1.2, 0)),
    legs: [
      [l.p0, k0],
      [k0, t0],
      [l.p1, k1],
      [k1, t1],
    ] as [THREE.Vector3, THREE.Vector3][],
    path: [l.p0, k0, t0, c.clone().add(V(0, 0.4, 0)), t1, k1, l.p1],
  };
};

// ---- Button / buzzer: a body centred between the legs -----------------------------------
export const bodyShape = (l: Layout, lift: number) => {
  const c = l.mid.clone().add(V(0, lift, 0));
  return {
    c,
    legs: [
      [l.p0, l.p0.clone().add(V(0, 0.25, 0))],
      [l.p1, l.p1.clone().add(V(0, 0.25, 0))],
    ] as [THREE.Vector3, THREE.Vector3][],
    path: [l.p0, l.p0.clone().add(V(0, 0.25, 0)), c, l.p1.clone().add(V(0, 0.25, 0)), l.p1],
  };
};

// ---- Jumper wire --------------------------------------------------------------------------
export const wireCurve = (l: Layout) => {
  const h = 0.55 + Math.min(3.2, l.span * 0.2);
  const pts = [
    l.p0.clone().add(V(0, -0.05, 0)),
    l.p0.clone().add(V(0, h * 0.75, 0)),
    l.mid.clone().add(V(0, h, 0)),
    l.p1.clone().add(V(0, h * 0.75, 0)),
    l.p1.clone().add(V(0, -0.05, 0)),
  ];
  if (l.span < 1.5) pts.splice(1, 3, l.mid.clone().add(V(0, h, 0)));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
};

// ---- Battery --------------------------------------------------------------------------------
export const DESK_Y = -BOARD_H;
export const batteryBox = (type: BatteryType) => {
  if (type === '9v') {
    const size = V(2.6, 1.75, 4.6);
    const c = V(-14.2, DESK_Y + size.y / 2, -13.6);
    return { size, c, front: c.z + size.z / 2 };
  }
  const cells = type === 'aa2' ? 2 : 3;
  const size = V(cells * 1.12 + 0.5, 1.25, 6.2);
  const c = V(-14.2, DESK_Y + size.y / 2, -14.0);
  return { size, c, front: c.z + size.z / 2, cells };
};

export const batteryLeads = (p: Part) => {
  const box = batteryBox(p.battery ?? '9v');
  const y = box.c.y + (p.battery === '9v' ? 0.2 : 0);
  const sPlus = V(box.c.x - 0.5, y, box.front + 0.55);
  const sMinus = V(box.c.x + 0.5, y, box.front + 0.55);
  const curve = (s: THREE.Vector3, pin: THREE.Vector3) =>
    new THREE.CatmullRomCurve3(
      [s, s.clone().add(V(0, 0.4, 0.6)), V((s.x + pin.x) / 2, 1.6, pin.z - 1.4), pin.clone().add(V(0, 0.8, 0)), pin.clone().add(V(0, -0.05, 0))],
      false,
      'centripetal'
    );
  return { plus: curve(sPlus, pinPos(p.pins[0])), minus: curve(sMinus, pinPos(p.pins[1])), sPlus, sMinus, box };
};

// Polyline the current follows from pins[0] to pins[1] through a part.
export const partPath = (p: Part): THREE.Vector3[] => {
  if (p.kind === 'battery') {
    const { plus, minus } = batteryLeads(p);
    return [...plus.getPoints(24).reverse(), ...minus.getPoints(24)];
  }
  const l = layoutOf(p);
  switch (p.kind) {
    case 'wire':
      return wireCurve(l).getPoints(Math.max(12, Math.round(l.span * 3)));
    case 'resistor':
      return resistorShape(l).path;
    case 'led':
      return ledShape(l).path;
    case 'button':
      return bodyShape(l, 0.45).path;
    case 'buzzer':
      return bodyShape(l, 0.55).path;
    default:
      return [l.p0, l.p1];
  }
};
