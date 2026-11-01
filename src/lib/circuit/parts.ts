// Part catalogue for Breadboard.exe: what each part is, its electrical model and its looks.

export type PartKind = 'battery' | 'resistor' | 'led' | 'button' | 'buzzer' | 'wire' | 'pot' | 'cap' | 'meter';
export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white';
export type WireColor = 'red' | 'black' | 'blue' | 'green' | 'yellow' | 'orange' | 'white';
export type BatteryType = 'aa2' | 'aa3' | '9v';

export interface Part {
  id: string;
  kind: PartKind;
  // pins[0] is + / anode / first leg, pins[1] is − / cathode / second leg. Hole ids.
  pins: [string, string];
  ohms?: number; // resistor; potentiometer full-scale value
  pos?: number; // potentiometer knob, 0..1
  uf?: number; // capacitor, microfarads
  color?: LedColor | WireColor; // led, wire
  burnt?: boolean; // led, capacitor (vented)
  battery?: BatteryType;
  on?: boolean; // battery switch
}

export const BATTERIES: Record<BatteryType, { label: string; volts: number; rInt: number }> = {
  aa2: { label: '2 × AA (3 V)', volts: 3, rInt: 0.3 },
  aa3: { label: '3 × AA (4.5 V)', volts: 4.5, rInt: 0.45 },
  '9v': { label: '9 V battery', volts: 9, rInt: 1.5 },
};

// Piecewise-linear LED model: conducts above Vf through a small series resistance.
export const LED_SPECS: Record<LedColor, { vf: number; rs: number; hex: string; glow: string; label: string }> = {
  red: { vf: 1.8, rs: 12, hex: '#ff2a3d', glow: '#ff4a4a', label: 'Red' },
  yellow: { vf: 2.0, rs: 14, hex: '#ffd21f', glow: '#ffe066', label: 'Yellow' },
  green: { vf: 2.1, rs: 14, hex: '#28e070', glow: '#66ff99', label: 'Green' },
  blue: { vf: 3.0, rs: 18, hex: '#2f6bff', glow: '#6aa0ff', label: 'Blue' },
  white: { vf: 3.0, rs: 18, hex: '#f2f6ff', glow: '#ffffff', label: 'White' },
};

// Active buzzer: polarised, needs ~1 V to start, draws ~25 mA at 5 V.
export const BUZZER = { vf: 1.0, rs: 160, minCurrent: 0.004 };

export const WIRE_HEX: Record<WireColor, string> = {
  red: '#e8242c',
  black: '#2a2a30',
  blue: '#2463e8',
  green: '#22b14c',
  yellow: '#f2c21b',
  orange: '#f2741b',
  white: '#e9e9ee',
};
export const WIRE_COLORS = Object.keys(WIRE_HEX) as WireColor[];

// LED limits (real 5 mm LEDs: ~20 mA typical, ~30 mA absolute max).
export const LED_FULL_BRIGHT = 0.02;
export const LED_HOT = 0.03;
export const LED_BURN = 0.045;
export const SHORT_CIRCUIT_AMPS = 1.2;

export const CAP_VALUES = [10, 100, 470, 1000, 2200, 4700];
export const formatFarads = (uf: number) => (uf >= 1000 ? `${+(uf / 1000).toFixed(1)} mF` : `${uf} µF`);
// Potentiometer resistance between its two legs for a knob position (never quite 0 Ω).
export const potOhms = (p: Part) => Math.max(1, (p.pos ?? 0.5) * (p.ohms ?? 10000));
export const POT_VALUES = [1000, 10000, 100000];
// Electrolytic capacitors are polarised: reversed by more than this for a moment, they vent.
export const CAP_REVERSE_LIMIT = 1.0;

export const RESISTOR_VALUES = [10, 47, 100, 150, 220, 330, 470, 680, 1000, 2200, 4700, 10000, 47000, 100000];

export const formatOhms = (ohms: number) =>
  ohms >= 1e6 ? `${+(ohms / 1e6).toFixed(2)} MΩ` : ohms >= 1000 ? `${+(ohms / 1000).toFixed(2)} kΩ` : `${ohms} Ω`;

export const formatAmps = (a: number) => {
  const v = Math.abs(a);
  if (v < 1e-6) return '0 mA';
  if (v < 1e-3) return `${(v * 1e6).toFixed(0)} µA`;
  if (v < 1) return `${(v * 1e3).toFixed(v < 0.01 ? 2 : 1)} mA`;
  return `${v.toFixed(2)} A`;
};

export const formatVolts = (v: number) => `${Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2)} V`;

// Resistor colour code (4-band: digit, digit, multiplier, gold tolerance).
const BAND_HEX = ['#1a1a1a', '#7a4a1f', '#e0242c', '#f2741b', '#f2d21b', '#22a64c', '#2463e8', '#8a3fd1', '#8a8a8a', '#f5f5f5'];
export const GOLD = '#c9a227';
export const resistorBands = (ohms: number): string[] => {
  let exp = 0;
  let v = Math.round(ohms);
  while (v >= 100) {
    v = Math.round(v / 10);
    exp++;
  }
  if (v < 10) {
    // values under 10 Ω use the gold (×0.1) multiplier
    const d = Math.round(ohms * 10);
    return [BAND_HEX[Math.floor(d / 10) % 10], BAND_HEX[d % 10], GOLD, GOLD];
  }
  return [BAND_HEX[Math.floor(v / 10)], BAND_HEX[v % 10], BAND_HEX[exp], GOLD];
};

// Longest distance (in hole pitches) between the two legs of each part.
export const MAX_SPAN: Record<PartKind, number> = {
  battery: Infinity,
  wire: Infinity,
  resistor: 8,
  led: 3.2,
  button: 4.2,
  buzzer: 4.2,
  pot: 4.2,
  cap: 3.2,
  meter: Infinity,
};

export const PART_LABEL: Record<PartKind, string> = {
  battery: 'Battery',
  resistor: 'Resistor',
  led: 'LED',
  button: 'Push button',
  buzzer: 'Buzzer',
  wire: 'Jumper wire',
  pot: 'Potentiometer',
  cap: 'Capacitor',
  meter: 'Multimeter',
};

export const partTitle = (p: Part) => {
  switch (p.kind) {
    case 'resistor':
      return `Resistor ${formatOhms(p.ohms ?? 220)}`;
    case 'led':
      return `${LED_SPECS[(p.color as LedColor) ?? 'red'].label} LED${p.burnt ? ' (burnt out)' : ''}`;
    case 'battery':
      return BATTERIES[p.battery ?? '9v'].label;
    case 'wire':
      return `${(p.color ?? 'red')[0].toUpperCase()}${(p.color ?? 'red').slice(1)} jumper wire`;
    case 'pot':
      return `Potentiometer ${formatOhms(p.ohms ?? 10000)}`;
    case 'cap':
      return `Capacitor ${formatFarads(p.uf ?? 1000)}${p.burnt ? ' (vented!)' : ''}`;
    case 'meter':
      return 'Multimeter (volts)';
    default:
      return PART_LABEL[p.kind];
  }
};

let seq = 0;
export const newPartId = (kind: PartKind) => `${kind}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
