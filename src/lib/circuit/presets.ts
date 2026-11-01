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
    id: 'dimmer',
    title: 'Dimmer knob',
    blurb: 'A potentiometer is a resistor you can turn. Drag its knob (or tap it and use the slider) to dim the LED. The 220 Ω keeps it safe at full brightness.',
    parts: [
      w('w1', 'tp3', 'a3', 'red'),
      { id: 'r1', kind: 'resistor', pins: ['b3', 'b6'], ohms: 220 },
      { id: 'p1', kind: 'pot', pins: ['c6', 'c9'], ohms: 10000, pos: 0.15 },
      { id: 'l1', kind: 'led', pins: ['d9', 'd10'], color: 'green' },
      w('w2', 'a10', 'tn10', 'black'),
    ],
  },
  {
    id: 'fade',
    title: 'Fade-out (capacitor)',
    blurb: 'Hold the button: the capacitor charges and the LED lights. Let go: the capacitor keeps the LED glowing and it slowly fades as the charge runs out.',
    parts: [
      w('w1', 'tp10', 'a10', 'red'),
      { id: 'b1', kind: 'button', pins: ['b10', 'b12'] },
      { id: 'r1', kind: 'resistor', pins: ['c12', 'c15'], ohms: 100 },
      { id: 'c1', kind: 'cap', pins: ['e15', 'e17'], uf: 2200 },
      w('w2', 'a17', 'tn17', 'black'),
      { id: 'r2', kind: 'resistor', pins: ['b15', 'b19'], ohms: 470 },
      { id: 'l1', kind: 'led', pins: ['c19', 'c20'], color: 'blue' },
      w('w3', 'a20', 'tn20', 'black'),
    ],
  },
  {
    id: 'meter',
    title: 'Measure it',
    blurb: 'Two equal resistors split 9 V in half. The multimeter’s red probe is on the middle and black is on −, so it reads about 4.5 V. Change a resistor and watch it move.',
    parts: [
      { id: 'r1', kind: 'resistor', pins: ['tp5', 'a5'], ohms: 1000 },
      { id: 'r2', kind: 'resistor', pins: ['b5', 'b9'], ohms: 1000 },
      w('w1', 'a9', 'tn9', 'black'),
      { id: 'm1', kind: 'meter', pins: ['d5', 'tn14'] },
    ],
  },
  {
    id: 'no-resistor',
    title: 'No resistor?!',
    blurb: 'An LED straight across 9 V. Over half an amp flows: it flares, flickers and burns out. This is why we use resistors.',
    parts: [w('w1', 'tp3', 'a3', 'red'), { id: 'l1', kind: 'led', pins: ['c3', 'c4'], color: 'red' }, w('w2', 'a4', 'tn4', 'black')],
  },
];
