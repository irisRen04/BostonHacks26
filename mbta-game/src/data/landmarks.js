// Landmarks riders can discover. Positions are in the same NAD83 Massachusetts
// State Plane meters as the stations (converted from OpenStreetMap lat/lon).
import { PALETTE } from '../theme/pixel';

/**
 * Build a tower of offset, stacked glass blocks (like CDS's "Jenga" floors).
 * blocks: [{ x, w, h }] from the top down, in sprite pixels.
 */
function stackedTower(width, blocks) {
  const height = blocks.reduce((sum, b) => sum + b.h, 0) + 1;
  const grid = Array.from({ length: height }, () => Array(width).fill('.'));
  let y = 0;
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    // outline row on top of this block (also the bottom edge of the one above)
    for (let x = b.x; x < b.x + b.w; x++) grid[y][x] = 'K';
    if (prev) for (let x = prev.x; x < prev.x + prev.w; x++) grid[y][x] = 'K';
    for (let r = 1; r < b.h; r++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const edge = x === b.x || x === b.x + b.w - 1;
        const col = x - b.x;
        grid[y + r][x] = edge ? 'K' : r === 1 ? 'L' : col % 3 === 0 ? 'F' : r % 2 ? 'G' : 'D';
      }
    }
    y += b.h;
  });
  const last = blocks[blocks.length - 1];
  for (let x = last.x; x < last.x + last.w; x++) grid[y][x] = 'K';
  return grid.map((row) => row.join(''));
}

// 5-pixel-tall block letters for signs ('#' = ink of the sign text)
const LETTERS = {
  C: ['###', '#..', '#..', '#..', '###'],
  I: ['#', '#', '#', '#', '#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
};

/**
 * Kenmore Square's Citgo sign: a big triangle over smaller CITGO lettering, on a
 * steel frame atop a brick roof. Also returns which rows are the lit sign face.
 */
function citgoSign() {
  const word = 'CITGO';
  const textWidth = word.length * 3 - 2 + (word.length - 1); // letters (I is 1 wide) + 1px gaps
  const W = textWidth + 6; // border + 2px padding each side
  const mid = Math.floor(W / 2);
  const rows = [];
  const line = (fn) => rows.push(Array.from({ length: W }, (_, x) => fn(x)).join(''));
  const edge = (x) => x === 0 || x === W - 1;
  const blank = (x) => (edge(x) ? 'K' : 'W');

  line(() => 'K');
  const faceStart = rows.length;
  line(blank);
  // the triangle fills almost the whole width: red edge, orange inside
  const TRI = mid - 1; // rows; base is 2*TRI-1 wide
  for (let r = 0; r < TRI; r++) {
    line((x) => {
      if (edge(x)) return 'K';
      const d = Math.abs(x - mid);
      if (d > r) return 'W';
      const inside = r >= 2 && r < TRI - 1 && d < r - 1;
      return inside ? 'O' : 'R';
    });
  }
  line(blank);
  // CITGO in blue, smaller than the triangle
  const pad = Math.floor((W - textWidth) / 2);
  for (let r = 0; r < 5; r++) {
    const text = word
      .split('')
      .map((ch) => LETTERS[ch][r])
      .join('.')
      .replace(/#/g, 'B')
      .replace(/\./g, 'W');
    line((x) => (edge(x) ? 'K' : x - pad >= 0 && x - pad < text.length ? text[x - pad] : 'W'));
  }
  line(blank);
  const faceEnd = rows.length;
  line(() => 'K');
  // steel frame: two legs per side with cross braces
  const legs = [3, 6, W - 7, W - 4];
  for (let r = 0; r < 3; r++) {
    line((x) => {
      if (legs.includes(x)) return 'S';
      const brace = (x > 3 && x < 6) || (x > W - 7 && x < W - 4);
      return brace && r === 1 ? 'S' : '.';
    });
  }
  // brick rooftop with a row of windows
  line(() => 'K');
  line((x) => (edge(x) ? 'K' : 'N'));
  line((x) => (edge(x) ? 'K' : x % 3 === 1 ? 'M' : 'N'));
  line((x) => (edge(x) ? 'K' : 'N'));
  return { rows, faceStart, faceEnd };
}

const CITGO = citgoSign();

const CDS_COLORS = {
  K: PALETTE.ink,
  L: '#d8ecf7', // sky reflection on the top row of each floor block
  G: '#86b8dc', // glass
  D: '#5b8db8', // darker glass
  F: '#eef2f5', // white mullions
};

const CITGO_COLORS = {
  K: PALETTE.ink,
  W: '#f4f4f4', // sign face
  R: '#ff3b2f', // triangle red (lit)
  O: '#ffa126', // triangle orange (lit)
  B: '#2b4fb3', // CITGO lettering
  S: '#6b7393', // steel frame
  N: '#9b4a35', // brick
  M: '#ffd23f', // lit windows
};

// The same sign with its lights off.
const CITGO_UNLIT = { W: '#aeb3bf', R: '#7a3532', O: '#8a5a33', B: '#3e4a78' };

/** Undiscovered landmarks: outline stays, everything else turns a dark slate. */
export function silhouetteOf(colors) {
  return Object.fromEntries(Object.keys(colors).map((k) => [k, k === 'K' ? PALETTE.ink : '#4a5068']));
}

export const landmarks = [
  {
    id: 'cds',
    name: 'Center for Computing & Data Sciences',
    shortName: 'CDS',
    owner: 'Boston University',
    address: '665 Commonwealth Ave',
    x: 232701,
    y: 900023,
    nearestStop: 'boston-university-east',
    blurb: "Boston University's 19-story home for computing and data sciences, and the tallest building on campus.",
    fact: 'Nicknamed "the Jenga building" for its stacked, offset floors.',
    colors: CDS_COLORS,
    sprite: stackedTower(16, [
      { x: 4, w: 10, h: 4 },
      { x: 1, w: 10, h: 4 },
      { x: 5, w: 10, h: 4 },
      { x: 2, w: 10, h: 4 },
      { x: 4, w: 10, h: 5 },
    ]),
  },
  {
    id: 'citgo',
    name: 'Citgo Sign',
    shortName: 'CITGO',
    owner: 'Kenmore Square',
    address: '660 Beacon St',
    x: 233268,
    y: 899946,
    nearestStop: 'kenmore',
    blurb: 'The glowing sign over Kenmore Square, a Boston icon you can spot from all over the city.',
    fact: 'It rises just beyond Fenway Park\'s Green Monster, so it shows up on TV during Red Sox games.',
    colors: CITGO_COLORS,
    sprite: CITGO.rows,
    // the real sign's lights come on from the top down, then it starts over
    lightUp: { from: CITGO.faceStart, to: CITGO.faceEnd, unlit: CITGO_UNLIT },
  },
];

export const landmarksById = Object.fromEntries(landmarks.map((l) => [l.id, l]));
