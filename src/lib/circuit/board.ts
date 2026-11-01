// Breadboard geometry and connectivity, shared by the solver and the 3D scene.
//
// One unit = one hole pitch (2.54 mm). The board is a 30-column "half+" breadboard:
//   top power rails   tp (+, red) and tn (−, blue)
//   main area         rows a–e (top half) and f–j (bottom half), split by the centre ditch
//   bottom power rails bn (−, blue) and bp (+, red)
// Inside the main area every column of five holes (a–e or f–j) is one metal strip.
// Each power rail is one long strip. Rails have a gap after every fifth hole, like real boards.

export const COLS = 30;

export type RowId = 'tp' | 'tn' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'bn' | 'bp';

export const ROWS: RowId[] = ['tp', 'tn', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'bn', 'bp'];

// z position (towards the viewer is +z) of each row.
export const ROW_Z: Record<RowId, number> = {
  tp: -8.2,
  tn: -7.2,
  a: -5,
  b: -4,
  c: -3,
  d: -2,
  e: -1,
  f: 1,
  g: 2,
  h: 3,
  i: 4,
  j: 5,
  bn: 7.2,
  bp: 8.2,
};

export const BOARD_W = 32.4;
export const BOARD_D = 19.6;
export const BOARD_H = 1.6; // thickness

export const isRail = (row: RowId) => row === 'tp' || row === 'tn' || row === 'bp' || row === 'bn';
export const railHasHole = (col: number) => col % 6 !== 0;

export const colX = (col: number) => col - (COLS + 1) / 2;

export interface Hole {
  id: string; // e.g. "c12", "tp5"
  row: RowId;
  col: number; // 1..30
  x: number;
  z: number;
}

export const holeId = (row: RowId, col: number) => `${row}${col}`;

const HOLES: Hole[] = [];
const BY_ID = new Map<string, Hole>();
for (const row of ROWS) {
  for (let col = 1; col <= COLS; col++) {
    if (isRail(row) && !railHasHole(col)) continue;
    const h: Hole = { id: holeId(row, col), row, col, x: colX(col), z: ROW_Z[row] };
    HOLES.push(h);
    BY_ID.set(h.id, h);
  }
}

export const ALL_HOLES: readonly Hole[] = HOLES;
export const getHole = (id: string): Hole | undefined => BY_ID.get(id);

// Electrical net a hole belongs to. Holes on the same net are joined by the board's metal clips.
export const netOf = (id: string): string => {
  const h = BY_ID.get(id);
  if (!h) return `x:${id}`;
  if (isRail(h.row)) return h.row;
  return `${'abcde'.includes(h.row) ? 'U' : 'D'}${h.col}`;
};

export const holesOnNet = (net: string): Hole[] => HOLES.filter((h) => netOf(h.id) === net);

// Nearest hole to a point on the board surface, or null when the point is between holes.
export const nearestHole = (x: number, z: number, maxDist = 0.55): Hole | null => {
  const col = Math.round(x + (COLS + 1) / 2);
  if (col < 1 || col > COLS) return null;
  let best: Hole | null = null;
  let bestD = maxDist;
  for (const row of ROWS) {
    const h = BY_ID.get(holeId(row, col));
    if (!h) continue;
    const d = Math.hypot(h.x - x, h.z - z);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
};

export const holeDistance = (a: string, b: string) => {
  const ha = BY_ID.get(a);
  const hb = BY_ID.get(b);
  if (!ha || !hb) return Infinity;
  return Math.hypot(ha.x - hb.x, ha.z - hb.z);
};

export const ROW_LABEL: Record<RowId, string> = {
  tp: '+ rail (top)',
  tn: '− rail (top)',
  bp: '+ rail (bottom)',
  bn: '− rail (bottom)',
  a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h', i: 'i', j: 'j',
};

export const describeHole = (id: string) => {
  const h = BY_ID.get(id);
  if (!h) return id;
  return isRail(h.row) ? `${ROW_LABEL[h.row]} · ${h.col}` : `${h.row}${h.col}`;
};
