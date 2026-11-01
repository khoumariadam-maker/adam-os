// Canvas-drawn textures for Breadboard.exe (no image files to download).

import * as THREE from 'three';
import { ALL_HOLES, BOARD_D, BOARD_W, COLS, ROW_Z, colX, isRail } from '@/lib/circuit/board';

const PX = 64; // texture pixels per hole pitch

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
};

const finish = (c: HTMLCanvasElement, aniso = 8) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
};

export const boardTexture = () => {
  const W = Math.round(BOARD_W * PX);
  const H = Math.round(BOARD_D * PX);
  const [c, g] = canvas(W, H);
  const X = (x: number) => (x + BOARD_W / 2) * PX;
  const Z = (z: number) => (z + BOARD_D / 2) * PX;

  g.fillStyle = '#f4f0e6';
  g.fillRect(0, 0, W, H);
  // subtle plastic grain
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.05)';
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  // grooves between the rails and the main area, and the centre ditch
  const groove = (z: number, h: number) => {
    g.fillStyle = '#ddd6c6';
    g.fillRect(0, Z(z) - (h * PX) / 2, W, h * PX);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(0, Z(z) - (h * PX) / 2, W, 3);
  };
  groove(0, 0.9);
  groove(-6.1, 0.18);
  groove(6.1, 0.18);

  // red (+) and blue (−) rail lines
  const line = (z: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(X(colX(1) - 0.6), Z(z) - 4, (COLS + 0.2) * PX, 8);
  };
  line(ROW_Z.tp - 0.62, '#e0242c');
  line(ROW_Z.tn + 0.62, '#2463e8');
  line(ROW_Z.bn - 0.62, '#2463e8');
  line(ROW_Z.bp + 0.62, '#e0242c');

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const sign = (z: number, s: string, color: string) => {
    g.fillStyle = color;
    g.font = `bold ${Math.round(PX * 0.62)}px ui-monospace, Menlo, monospace`;
    g.fillText(s, X(colX(1) - 1.05), Z(z));
    g.fillText(s, X(colX(COLS) + 1.05), Z(z));
  };
  sign(ROW_Z.tp, '+', '#e0242c');
  sign(ROW_Z.tn, '−', '#2463e8');
  sign(ROW_Z.bn, '−', '#2463e8');
  sign(ROW_Z.bp, '+', '#e0242c');

  // row letters and column numbers
  g.fillStyle = '#8b8577';
  g.font = `bold ${Math.round(PX * 0.42)}px ui-monospace, Menlo, monospace`;
  for (const row of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const) {
    g.fillText(row, X(colX(1) - 1.05), Z(ROW_Z[row]));
    g.fillText(row, X(colX(COLS) + 1.05), Z(ROW_Z[row]));
  }
  for (let col = 1; col <= COLS; col++) {
    if (col !== 1 && col % 5 !== 0) continue;
    g.fillText(String(col), X(colX(col)), Z(ROW_Z.a - 0.85));
    g.fillText(String(col), X(colX(col)), Z(ROW_Z.j + 0.85));
  }

  // holes: dark square with a lighter bevel
  const s = 0.3 * PX;
  for (const h of ALL_HOLES) {
    const x = X(h.x) - s / 2;
    const y = Z(h.z) - s / 2;
    g.fillStyle = '#d6cfbf';
    g.fillRect(x - 4, y - 4, s + 8, s + 8);
    g.fillStyle = isRail(h.row) ? '#3a3631' : '#45403a';
    g.fillRect(x, y, s, s);
    g.fillStyle = '#141311';
    g.fillRect(x + 3, y + 4, s - 6, s - 7);
  }
  return finish(c);
};

export const matTexture = () => {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#21493f';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i <= 16; i++) {
    const p = i * 32;
    g.fillStyle = i % 4 === 0 ? 'rgba(220,255,240,0.20)' : 'rgba(220,255,240,0.08)';
    const w = i % 4 === 0 ? 2 : 1;
    g.fillRect(p, 0, w, 512);
    g.fillRect(0, p, 512, w);
  }
  const t = finish(c, 4);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
};

export const glowTexture = () => {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return finish(c, 1);
};

export const smokeTexture = () => {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return finish(c, 1);
};

// Wrap-around label for the 9 V battery.
export const batteryLabel = () => {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#1d1d22';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#f2a01b';
  g.fillRect(0, 70, 512, 116);
  g.fillStyle = '#1d1d22';
  g.font = 'bold 84px ui-monospace, Menlo, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('9V', 256, 130);
  g.fillStyle = '#f4f0e6';
  g.font = 'bold 34px ui-monospace, Menlo, monospace';
  g.fillText('ADAM-CELL', 256, 34);
  g.fillText('+  ALKALINE  −', 256, 222);
  return finish(c, 4);
};

// Multimeter LCD: redrawn whenever the reading changes.
export const drawLcd = (c: HTMLCanvasElement, text: string, unit: string) => {
  const g = c.getContext('2d')!;
  g.fillStyle = '#a9bfa2';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  g.fillRect(0, c.height - 10, c.width, 10);
  g.fillStyle = '#18261a';
  g.textBaseline = 'middle';
  g.textAlign = 'right';
  g.font = 'bold 92px ui-monospace, Menlo, monospace';
  g.fillText(text, c.width - 70, c.height / 2 + 4);
  g.font = 'bold 34px ui-monospace, Menlo, monospace';
  g.fillText(unit, c.width - 12, c.height / 2 + 24);
  g.textAlign = 'left';
  g.font = 'bold 22px ui-monospace, Menlo, monospace';
  g.fillText('DC', 12, 22);
};
export const lcdTexture = () => {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 144;
  drawLcd(c, '0.00', 'V');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { canvas: c, texture: t };
};
