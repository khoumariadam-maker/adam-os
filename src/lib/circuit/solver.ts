// DC circuit solver for Breadboard.exe, using Modified Nodal Analysis (MNA): the same
// method SPICE uses. Every net gets an unknown voltage, every voltage source an unknown
// current, and Kirchhoff's current law gives one linear equation per net.
//
// LEDs and the buzzer are diodes, which are not linear. They use a piecewise-linear model
// (off, or "Vf in series with a small resistance"), and the solver repeats the linear solve
// until every diode's on/off state agrees with the voltages it produced.
//
// Capacitors need time. With a `transient` step the solver uses the backward-Euler
// companion model: over a step dt a capacitor acts like a conductance C/dt in parallel
// with a current source that remembers its previous voltage. Without a step they are open.

import { netOf } from './board';
import { BATTERIES, BUZZER, LED_SPECS, LedColor, Part, SHORT_CIRCUIT_AMPS, potOhms } from './parts';

export interface PartResult {
  current: number; // A, flowing from pins[0] to pins[1] through the part
  drop: number; // V(pins[0]) − V(pins[1])
  power: number; // W
  on: boolean; // LED lit / buzzer sounding / button closed / battery delivering
}

export interface SolveResult {
  net: Record<string, number>; // net id -> voltage relative to the battery's − terminal
  parts: Record<string, PartResult>;
  batteryCurrent: number;
  short: boolean;
  capV: Record<string, number>; // capacitor voltages (pins[0] − pins[1]) after this step
  // Nets with some path (through any part, open buttons excepted) to the battery.
  reachable: Set<string>;
  iterations: number;
}

const R_WIRE = 0.02;
const R_SWITCH = 0.05;
const G_MIN = 1e-9; // tiny leak to ground so floating nets stay defined

// Solves A x = b in place with partial pivoting. Returns null when singular.
const gauss = (A: Float64Array[], b: Float64Array): Float64Array | null => {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    let max = Math.abs(A[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r][col]);
      if (v > max) {
        max = v;
        piv = r;
      }
    }
    if (max < 1e-15) return null;
    if (piv !== col) {
      [A[piv], A[col]] = [A[col], A[piv]];
      [b[piv], b[col]] = [b[col], b[piv]];
    }
    const rowC = A[col];
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / rowC[col];
      if (f === 0) continue;
      const row = A[r];
      for (let k = col; k < n; k++) row[k] -= f * rowC[k];
      b[r] -= f * b[col];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
};

interface Diode {
  part: Part;
  vf: number;
  g: number;
  on: boolean;
}

export interface Transient {
  capV: Record<string, number>; // voltages at the end of the previous step
  dt: number; // seconds
}

export const solveCircuit = (parts: Part[], pressed: ReadonlySet<string> = new Set(), transient?: Transient): SolveResult => {
  const battery = parts.find((p) => p.kind === 'battery');
  const nets = new Map<string, number>(); // net -> matrix index (ground = -1)
  const ground = battery ? netOf(battery.pins[1]) : null;
  const idx = (net: string) => {
    if (net === ground) return -1;
    let i = nets.get(net);
    if (i === undefined) {
      i = nets.size;
      nets.set(net, i);
    }
    return i;
  };
  // Register nets up front so the matrix size is known.
  for (const p of parts) for (const pin of p.pins) idx(netOf(pin));

  const battOn = !!battery && battery.on !== false;
  const spec = BATTERIES[battery?.battery ?? '9v'];
  // Extra unknowns: battery internal node + source current.
  const nNodes = nets.size + (battOn ? 1 : 0);
  const N = nNodes + (battOn ? 1 : 0);
  const internal = nets.size;
  const srcRow = nNodes;

  const diodes: Diode[] = [];
  for (const p of parts) {
    if (p.kind === 'led' && !p.burnt) {
      const s = LED_SPECS[(p.color as LedColor) ?? 'red'];
      diodes.push({ part: p, vf: s.vf, g: 1 / s.rs, on: false });
    } else if (p.kind === 'buzzer') {
      diodes.push({ part: p, vf: BUZZER.vf, g: 1 / BUZZER.rs, on: false });
    }
  }

  const conductance = (p: Part): number => {
    switch (p.kind) {
      case 'wire':
        return 1 / R_WIRE;
      case 'resistor':
        return 1 / Math.max(0.1, p.ohms ?? 220);
      case 'pot':
        return 1 / potOhms(p);
      case 'button':
        return pressed.has(p.id) ? 1 / R_SWITCH : 0;
      default:
        return 0;
    }
  };

  let x: Float64Array = new Float64Array(N);
  let iterations = 0;
  for (; iterations < 40; iterations++) {
    const A = Array.from({ length: N }, () => new Float64Array(N));
    const b = new Float64Array(N);
    const stampG = (i: number, j: number, g: number) => {
      if (i >= 0) A[i][i] += g;
      if (j >= 0) A[j][j] += g;
      if (i >= 0 && j >= 0) {
        A[i][j] -= g;
        A[j][i] -= g;
      }
    };
    for (let i = 0; i < nNodes; i++) A[i][i] += G_MIN;
    for (const p of parts) {
      const g = conductance(p);
      if (g > 0) stampG(idx(netOf(p.pins[0])), idx(netOf(p.pins[1])), g);
    }
    if (transient) {
      for (const p of parts) {
        if (p.kind !== 'cap' || p.burnt) continue;
        const g = ((p.uf ?? 1000) * 1e-6) / transient.dt;
        const a = idx(netOf(p.pins[0]));
        const c = idx(netOf(p.pins[1]));
        const vPrev = transient.capV[p.id] ?? 0;
        stampG(a, c, g);
        if (a >= 0) b[a] += g * vPrev;
        if (c >= 0) b[c] -= g * vPrev;
      }
    }
    for (const d of diodes) {
      if (!d.on) continue;
      const a = idx(netOf(d.part.pins[0]));
      const c = idx(netOf(d.part.pins[1]));
      stampG(a, c, d.g);
      // Norton equivalent of the Vf source: current g·Vf pushed from cathode to anode.
      if (a >= 0) b[a] += d.g * d.vf;
      if (c >= 0) b[c] -= d.g * d.vf;
    }
    if (battOn && battery) {
      // + terminal --rInt-- internal node ==[V source]== − terminal (ground)
      stampG(idx(netOf(battery.pins[0])), internal, 1 / spec.rInt);
      A[internal][srcRow] += 1;
      A[srcRow][internal] += 1;
      b[srcRow] = spec.volts;
    }
    const sol = N ? gauss(A, b) : new Float64Array(0);
    if (!sol) break;
    x = sol;

    let changed = false;
    for (const d of diodes) {
      const va = (() => {
        const i = idx(netOf(d.part.pins[0]));
        return i < 0 ? 0 : x[i];
      })();
      const vc = (() => {
        const i = idx(netOf(d.part.pins[1]));
        return i < 0 ? 0 : x[i];
      })();
      const vd = va - vc;
      if (!d.on && vd > d.vf + 1e-6) {
        d.on = true;
        changed = true;
      } else if (d.on && vd < d.vf - 1e-6) {
        d.on = false;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const v = (net: string) => {
    const i = net === ground ? -1 : nets.get(net) ?? -1;
    return i < 0 ? 0 : x[i];
  };
  const net: Record<string, number> = {};
  nets.forEach((i, n) => (net[n] = x[i]));
  if (ground) net[ground] = 0;

  const results: Record<string, PartResult> = {};
  const diodeById = new Map(diodes.map((d) => [d.part.id, d]));
  let batteryCurrent = 0;
  const capV: Record<string, number> = {};
  for (const p of parts) {
    const drop = v(netOf(p.pins[0])) - v(netOf(p.pins[1]));
    let current = 0;
    let on = false;
    if (p.kind === 'battery') {
      // Source current in MNA flows into the + node of the source; delivered current is its negative.
      current = battOn ? -x[srcRow] : 0;
      batteryCurrent = current;
      on = battOn && current > 1e-5;
      // current flows out of + (pins[0]) through the circuit, so through the battery it goes − to +
      results[p.id] = { current: -current, drop, power: current * drop, on };
      continue;
    }
    const d = diodeById.get(p.id);
    if (p.kind === 'cap') {
      if (transient && !p.burnt) {
        const g = ((p.uf ?? 1000) * 1e-6) / transient.dt;
        current = g * (drop - (transient.capV[p.id] ?? 0));
        capV[p.id] = drop;
      } else capV[p.id] = transient?.capV[p.id] ?? 0;
      on = Math.abs(current) > 1e-5;
      results[p.id] = { current, drop: transient ? drop : capV[p.id], power: Math.abs(current * drop), on };
      continue;
    }
    if (p.kind === 'meter') {
      results[p.id] = { current: 0, drop, power: 0, on: false };
      continue;
    }
    if (d) {
      current = d.on ? d.g * (drop - d.vf) : 0;
      on = p.kind === 'buzzer' ? current > BUZZER.minCurrent : current > 1e-4;
    } else {
      current = conductance(p) * drop;
      on = p.kind === 'button' ? pressed.has(p.id) : Math.abs(current) > 1e-5;
    }
    results[p.id] = { current, drop, power: Math.abs(current * drop), on };
  }

  const reachable = new Set<string>();
  if (battery) {
    const adj = new Map<string, string[]>();
    const link = (a: string, b: string) => {
      adj.set(a, [...(adj.get(a) ?? []), b]);
      adj.set(b, [...(adj.get(b) ?? []), a]);
    };
    for (const p of parts) {
      if ((p.kind === 'button' && !pressed.has(p.id)) || p.kind === 'meter') continue;
      link(netOf(p.pins[0]), netOf(p.pins[1]));
    }
    const stack = [netOf(battery.pins[0]), netOf(battery.pins[1])];
    while (stack.length) {
      const n = stack.pop()!;
      if (reachable.has(n)) continue;
      reachable.add(n);
      stack.push(...(adj.get(n) ?? []));
    }
  }

  return {
    net,
    reachable,
    parts: results,
    batteryCurrent,
    capV,
    short: batteryCurrent > SHORT_CIRCUIT_AMPS,
    iterations,
  };
};
