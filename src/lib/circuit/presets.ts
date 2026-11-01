// Example circuits for Breadboard.exe. Every one uses the battery on the top rails (tp1 / tn1).

import type { Part } from './parts';

export const BATTERY_PART: Part = { id: 'battery', kind: 'battery', pins: ['tp1', 'tn1'], battery: '9v', on: true };

export interface Preset {
  id: string;
  title: string;
  blurb: string;
  parts: Part[];
}

const w = (id: string, a: string, b: string, color: Part['color']): Part => ({ id, kind: 'wire', pins: [a, b], color });

export const PRESETS: Preset[] = [
  {
    id: 'first-led',
    title: 'First LED',
    blurb: 'Battery → 330 Ω resistor → red LED → back to −. The resistor keeps the current near 20 mA.',
    parts: [
      w('w1', 'tp3', 'a3', 'red'),
      { id: 'r1', kind: 'resistor', pins: ['b3', 'b7'], ohms: 330 },
      { id: 'l1', kind: 'led', pins: ['d7', 'd8'], color: 'red' },
      w('w2', 'a8', 'tn8', 'black'),
    ],
  },
  {
    id: 'doorbell',
    title: 'Doorbell',
    blurb: 'Hold the button: the buzzer sounds and the yellow LED lights. Let go and the circuit opens.',
    parts: [
      w('w1', 'tp10', 'a10', 'red'),
      { id: 'b1', kind: 'button', pins: ['b10', 'b12'] },
      { id: 'z1', kind: 'buzzer', pins: ['c12', 'c14'] },
      w('w2', 'a14', 'tn14', 'black'),
      { id: 'r1', kind: 'resistor', pins: ['e12', 'e16'], ohms: 470 },
      { id: 'l1', kind: 'led', pins: ['d16', 'd17'], color: 'yellow' },
      w('w3', 'a17', 'tn17', 'black'),
    ],
  },
  {
    id: 'series',
    title: 'LEDs in series',
    blurb: 'Two green LEDs share one path, so the same current flows through both. Each one takes ~2 V.',
    parts: [
      w('w1', 'tp28', 'bp28', 'red'),
      w('w2', 'tn29', 'bn29', 'black'),
      w('w3', 'bp20', 'j20', 'orange'),
      { id: 'r1', kind: 'resistor', pins: ['i20', 'i23'], ohms: 220 },
      { id: 'l1', kind: 'led', pins: ['h23', 'h24'], color: 'green' },
      { id: 'l2', kind: 'led', pins: ['g24', 'g25'], color: 'green' },
      w('w4', 'j25', 'bn25', 'blue'),
    ],
  },
  {
    id: 'parallel',
    title: 'LEDs in parallel',
    blurb: 'Red and yellow LEDs side by side. The red one needs less voltage, so it grabs more of the current.',
    parts: [
      w('w1', 'tp3', 'a3', 'red'),
      { id: 'r1', kind: 'resistor', pins: ['b3', 'b7'], ohms: 220 },
      { id: 'l1', kind: 'led', pins: ['c7', 'c8'], color: 'red' },
      { id: 'l2', kind: 'led', pins: ['d7', 'd8'], color: 'yellow' },
      w('w2', 'a8', 'tn8', 'black'),
    ],
  },
  {
    id: 'no-resistor',
    title: 'No resistor?!',
    blurb: 'An LED straight across 9 V. Over half an amp flows: it flares, flickers and burns out. This is why we use resistors.',
    parts: [w('w1', 'tp3', 'a3', 'red'), { id: 'l1', kind: 'led', pins: ['c3', 'c4'], color: 'red' }, w('w2', 'a4', 'tn4', 'black')],
  },
];
