// Checks Breadboard.exe's circuit solver against hand calculations.
// Tolerances allow for the solver's tiny leak to ground (1 nS per node) that keeps floating nets defined.
// Run: npm run test:circuit
import { solveCircuit } from '../../src/lib/circuit/solver';
import type { Part } from '../../src/lib/circuit/parts';

let failures = 0;
const near = (name: string, got: number, want: number, tol: number) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: got ${got.toFixed(5)}, want ${want.toFixed(5)} ±${tol}`);
};
const is = (name: string, got: boolean, want: boolean) => {
  if (got !== want) failures++;
  console.log(`${got === want ? 'ok  ' : 'FAIL'} ${name}: ${got}`);
};

const bat = (battery: Part['battery'] = '9v', on = true): Part => ({ id: 'bat', kind: 'battery', pins: ['tp1', 'tn1'], battery, on });
const wire = (id: string, a: string, b: string): Part => ({ id, kind: 'wire', pins: [a, b] });
const res = (id: string, a: string, b: string, ohms: number): Part => ({ id, kind: 'resistor', pins: [a, b], ohms });
const led = (id: string, a: string, b: string, color: Part['color'] = 'red'): Part => ({ id, kind: 'led', pins: [a, b], color });
const R_INT_9V = 1.5;
const R_WIRE = 0.02;

// 9 V, 330 Ω, red LED (Vf 1.8 V, Rs 12 Ω): I = (9 − 1.8) / (330 + 12 + 1.5 + 2 wires)
{
  const r = solveCircuit([bat(), wire('w1', 'tp3', 'a3'), res('r1', 'b3', 'b7', 330), led('l1', 'd7', 'd8'), wire('w2', 'a8', 'tn8')]);
  near('series LED current', r.parts.l1.current, 7.2 / (330 + 12 + R_INT_9V + 2 * R_WIRE), 1e-6);
  near('battery current equals loop current', r.batteryCurrent, r.parts.l1.current, 1e-7);
  is('LED is lit', r.parts.l1.on, true);
}
// Reversed LED blocks current.
{
  const r = solveCircuit([bat(), wire('w1', 'tp3', 'a3'), res('r1', 'b3', 'b7', 330), led('l1', 'd8', 'd7'), wire('w2', 'a8', 'tn8')]);
  near('reversed LED current', r.parts.l1.current, 0, 1e-7);
  is('reversed LED is dark', r.parts.l1.on, false);
}
// Two green LEDs in series (Vf 2.1 V, Rs 14 Ω each) with 220 Ω.
{
  const r = solveCircuit([bat(), wire('w1', 'tp3', 'a3'), res('r1', 'b3', 'b7', 220), led('l1', 'd7', 'd8', 'green'), led('l2', 'b8', 'b9', 'green'), wire('w2', 'a9', 'tn9')]);
  near('series pair current', r.parts.l1.current, 4.8 / (220 + 28 + R_INT_9V + 2 * R_WIRE), 1e-6);
  near('same current through both', r.parts.l2.current, r.parts.l1.current, 1e-7);
}
// Blue LED (Vf 3.0 V) can't light from 3 V through a resistor.
{
  const r = solveCircuit([bat('aa2'), wire('w1', 'tp3', 'a3'), res('r1', 'b3', 'b7', 100), led('l1', 'd7', 'd8', 'blue'), wire('w2', 'a8', 'tn8')]);
  is('blue LED stays dark on 3 V', r.parts.l1.on, false);
}
// Voltage divider: two 1 kΩ across 9 V (with 1.5 Ω internal resistance).
{
  const r = solveCircuit([bat(), res('r1', 'tp5', 'a5', 1000), res('r2', 'b5', 'tn5', 1000)]);
  near('divider midpoint', r.net.U5, (9 * 1000) / (2000 + R_INT_9V), 1e-5);
}
// Parallel resistors: 1 kΩ ∥ 1 kΩ = 500 Ω.
{
  const r = solveCircuit([bat(), res('r1', 'tp5', 'tn5', 1000), res('r2', 'tp7', 'tn7', 1000)]);
  near('parallel total current', r.batteryCurrent, 9 / (500 + R_INT_9V), 1e-6);
}
// Button: open means no current; pressed closes the loop.
{
  const parts = [bat(), wire('w1', 'tp10', 'a10'), { id: 'b1', kind: 'button', pins: ['b10', 'b12'] } as Part, res('r1', 'c12', 'c16', 1000), wire('w2', 'a16', 'tn16')];
  near('button released', solveCircuit(parts).batteryCurrent, 0, 1e-7);
  near('button pressed', solveCircuit(parts, new Set(['b1'])).batteryCurrent, 9 / (1000 + R_INT_9V + 2 * R_WIRE + 0.05), 1e-6);
}
// Short circuit is flagged; switched-off battery delivers nothing.
{
  is('short detected', solveCircuit([bat(), wire('w1', 'tp3', 'tn3')]).short, true);
  near('battery off', solveCircuit([bat('9v', false), res('r1', 'tp5', 'tn5', 100)]).batteryCurrent, 0, 1e-7);
}
// Floating parts don't break the solve.
{
  const r = solveCircuit([bat(), res('r1', 'a20', 'b25', 220), led('l1', 'f3', 'f4')]);
  near('floating parts carry no current', Math.abs(r.parts.r1.current) + Math.abs(r.parts.l1.current), 0, 1e-7);
}

// Potentiometer at 25 % of 10 kΩ is a 2.5 kΩ resistor.
{
  const r = solveCircuit([bat(), { id: 'p1', kind: 'pot', pins: ['tp5', 'tn5'], ohms: 10000, pos: 0.25 }]);
  near('potentiometer current', r.batteryCurrent, 9 / (2500 + R_INT_9V), 1e-7);
}
// RC charging: after one time constant a capacitor reaches 63.2 % of the supply.
{
  const parts: Part[] = [bat(), res('r1', 'tp5', 'a5', 1000), { id: 'c1', kind: 'cap', pins: ['b5', 'tn5'], uf: 1000 }];
  const tau = (1000 + R_INT_9V) * 1000e-6;
  let capV: Record<string, number> = {};
  const dt = 0.0005;
  for (let t = 0; t < tau - dt / 2; t += dt) capV = solveCircuit(parts, new Set(), { capV, dt }).capV;
  near('RC charge after one tau', capV.c1, 9 * (1 - Math.exp(-1)), 0.01);
  // ...and it discharges back through a resistor once the battery is switched off.
  const off: Part[] = [bat('9v', false), res('r1', 'tp5', 'a5', 1000), { id: 'c1', kind: 'cap', pins: ['b5', 'tn5'], uf: 1000 }, res('r2', 'c5', 'tn7', 1000)];
  const v0 = capV.c1;
  for (let t = 0; t < 1 - dt / 2; t += dt) capV = solveCircuit(off, new Set(), { capV, dt }).capV;
  near('RC discharge after one tau', capV.c1, v0 * Math.exp(-1), 0.01);
}
// Capacitor is an open circuit once fully charged (no DC current).
{
  const parts: Part[] = [bat(), res('r1', 'tp5', 'a5', 100), { id: 'c1', kind: 'cap', pins: ['b5', 'tn5'], uf: 10 }];
  let capV: Record<string, number> = {};
  let last = solveCircuit(parts, new Set(), { capV, dt: 0.001 });
  for (let i = 0; i < 200; i++) {
    last = solveCircuit(parts, new Set(), { capV, dt: 0.001 });
    capV = last.capV;
  }
  near('charged capacitor blocks DC', last.batteryCurrent, 0, 1e-6);
}
// A multimeter draws no current and reads the voltage between its probes.
{
  const r = solveCircuit([bat(), res('r1', 'tp5', 'a5', 1000), res('r2', 'b5', 'b9', 1000), wire('w1', 'a9', 'tn9'), { id: 'm', kind: 'meter', pins: ['d5', 'tn14'] }]);
  near('meter reads the midpoint', r.parts.m.drop, (9 * 1000) / (2000 + R_INT_9V + R_WIRE), 1e-4);
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll circuit checks passed.');
