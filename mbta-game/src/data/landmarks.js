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

export const LANDMARK_COLORS = {
  K: PALETTE.ink,
  L: '#d8ecf7', // sky reflection on the top row of each floor block
  G: '#86b8dc', // glass
  D: '#5b8db8', // darker glass
  F: '#eef2f5', // white mullions
};

export const SILHOUETTE_COLORS = Object.fromEntries(Object.keys(LANDMARK_COLORS).map((k) => [k, k === 'K' ? PALETTE.ink : '#4a5068']));

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
    sprite: stackedTower(16, [
      { x: 4, w: 10, h: 4 },
      { x: 1, w: 10, h: 4 },
      { x: 5, w: 10, h: 4 },
      { x: 2, w: 10, h: 4 },
      { x: 4, w: 10, h: 5 },
    ]),
  },
];

export const landmarksById = Object.fromEntries(landmarks.map((l) => [l.id, l]));
