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

/** Kenmore Square's Citgo sign: billboard with the triangle and lettering, on a steel frame atop a brick roof. */
function citgoSign() {
  const word = 'CITGO';
  const inner = word.length * 3 - 2 + (word.length - 1); // letter widths (I is 1 wide) + 1px gaps
  const W = inner + 4; // border + padding on both sides
  const mid = Math.floor(W / 2);
  const rows = [];
  const line = (fn) => rows.push(Array.from({ length: W }, (_, x) => fn(x)).join(''));
  const edge = (x) => x === 0 || x === W - 1;

  line(() => 'K');
  line((x) => (edge(x) ? 'K' : 'W'));
  // the triangle: red outline, orange inside, growing 1px each side per row
  for (let r = 0; r < 6; r++) {
    line((x) => {
      if (edge(x)) return 'K';
      const d = Math.abs(x - mid);
      if (d > r) return 'W';
      return r >= 2 && r < 5 && d < r - 1 ? 'O' : 'R';
    });
  }
  line((x) => (edge(x) ? 'K' : 'W'));
  // CITGO in blue
  for (let r = 0; r < 5; r++) {
    const text = word
      .split('')
      .map((ch) => LETTERS[ch][r])
      .join('.')
      .replace(/#/g, 'B')
      .replace(/\./g, 'W');
    line((x) => (edge(x) ? 'K' : x - 2 >= 0 && x - 2 < text.length ? text[x - 2] : 'W'));
  }
  line((x) => (edge(x) ? 'K' : 'W'));
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
  return rows;
}

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
  R: '#d9413b', // triangle red
  O: '#f08a24', // triangle orange
  B: '#2b4fb3', // CITGO lettering
  S: '#6b7393', // steel frame
  N: '#9b4a35', // brick
  M: '#ffd23f', // lit windows
};

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
    sprite: citgoSign(),
  },
];

export const landmarksById = Object.fromEntries(landmarks.map((l) => [l.id, l]));
