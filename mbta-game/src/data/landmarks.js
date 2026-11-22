// Landmarks riders can discover. Positions are in the same NAD83 Massachusetts
// State Plane meters as the stations (converted from OpenStreetMap lat/lon).
import { PALETTE } from '../theme/pixel';
import * as art from './landmarkSprites';
import { moreLandmarks } from './moreLandmarks';

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
 * steel frame atop a brick roof. Also returns, for each triangle pixel, which ring it
 * is in (0 = outer edge, counting inward) so the lights can come on from the outside in.
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
  line(blank);
  // the triangle fills almost the whole width: dark red edge, medium red inside
  const TRI = mid - 1; // rows; base is 2*TRI-1 wide
  const triStart = rows.length;
  const ringAt = {}; // "x,y" -> ring number
  for (let r = 0; r < TRI; r++) {
    for (let x = mid - r; x <= mid + r; x++) {
      // pixels in from the nearest slanted side, or up from the bottom edge
      ringAt[`${x},${triStart + r}`] = Math.min(r - Math.abs(x - mid), TRI - 1 - r);
    }
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
  const rings = Math.max(...Object.values(ringAt)) + 1;
  return { rows, rings, ringOf: (x, y) => ringAt[`${x},${y}`] ?? -1 };
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
  // official CITGO reds (CITGO Logo Guidelines)
  R: '#B8292F', // triangle edge: Dark Red, Pantone 187 C, RGB 184/41/47
  O: '#E32026', // triangle fill: Medium Red, Pantone 185 C, RGB 227/32/38
  B: '#2b4fb3', // CITGO lettering
  S: '#6b7393', // steel frame
  N: '#9b4a35', // brick
  M: '#ffd23f', // lit windows
};

// The triangle with its lights off. The white face and lettering never change.
const CITGO_UNLIT = { R: '#5c1f22', O: '#7a2428' };

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
    // the triangle's lights come on ring by ring from the outside in, then it starts over
    lightUp: { steps: CITGO.rings, stepOf: CITGO.ringOf, stepMs: 160, unlit: CITGO_UNLIT },
  },
  ...[
    {
      id: 'fenway-park',
      draw: art.fenwayPark,
      name: 'Fenway Park',
      shortName: 'FENWAY',
      owner: 'Fenway',
      address: '4 Jersey St',
      x: 233198,
      y: 899630,
      nearestStop: 'kenmore',
      blurb: 'Home of the Boston Red Sox since 1912, the oldest ballpark in Major League Baseball.',
      fact: 'Its 37-foot left-field wall is nicknamed the Green Monster.',
    },
    {
      id: 'bpl',
      draw: art.bostonPublicLibrary,
      name: 'Boston Public Library',
      shortName: 'BPL',
      owner: 'Back Bay',
      address: '700 Boylston St',
      x: 234716,
      y: 899956,
      nearestStop: 'copley',
      blurb: 'The grand McKim Building on Copley Square, home of the first large free public library in the US.',
      fact: 'The words "FREE TO ALL" are carved above its entrance.',
    },
    {
      id: 'prudential',
      draw: art.prudentialTower,
      name: 'Prudential Tower',
      shortName: 'PRU',
      owner: 'Back Bay',
      address: '800 Boylston St',
      x: 234400,
      y: 899715,
      nearestStop: 'prudential',
      blurb: 'A 52-story Back Bay skyscraper you can spot from all over the city.',
      fact: 'Its top floors hold an observation deck with views across Boston.',
    },
    {
      id: 'swan-boats',
      draw: art.swanBoats,
      name: 'Swan Boats',
      shortName: 'SWAN BOATS',
      owner: 'Public Garden',
      address: 'Public Garden lagoon',
      x: 235435,
      y: 900493,
      nearestStop: 'arlington',
      blurb: 'Pedal-powered swan boats gliding around the Public Garden lagoon since 1877.',
      fact: 'The same family has run the Swan Boats since they started.',
    },
    {
      id: 'state-house',
      draw: art.stateHouse,
      name: 'Massachusetts State House',
      shortName: 'STATE HOUSE',
      owner: 'Beacon Hill',
      address: '24 Beacon St',
      x: 235928,
      y: 900992,
      nearestStop: 'park-street',
      blurb: 'The seat of Massachusetts government, looking over Boston Common since 1798.',
      fact: 'Its dome is covered in 23-karat gold leaf.',
    },
    {
      id: 'faneuil-hall',
      draw: art.faneuilHall,
      name: 'Faneuil Hall',
      shortName: 'FANEUIL',
      owner: 'Downtown',
      address: 'Faneuil Hall Sq',
      x: 236557,
      y: 901154,
      nearestStop: 'government-center',
      blurb: 'A marketplace and meeting hall since 1742, nicknamed the Cradle of Liberty.',
      fact: 'A gilded grasshopper weathervane has topped its cupola since 1742.',
    },
    {
      id: 'td-garden',
      draw: art.tdGarden,
      name: 'TD Garden',
      shortName: 'GARDEN',
      owner: 'West End',
      address: '100 Legends Way',
      x: 236065,
      y: 901848,
      nearestStop: 'north-station',
      blurb: 'Home of the Celtics and the Bruins, built right on top of North Station.',
      fact: 'The Celtics play on a parquet floor.',
    },
    {
      id: 'museum-of-science',
      draw: art.museumOfScience,
      name: 'Museum of Science',
      shortName: 'SCIENCE',
      owner: 'West End',
      address: '1 Science Park',
      x: 235328,
      y: 901968,
      nearestStop: 'science-park-west-end',
      blurb: 'A hands-on science museum built right on the Charles River Dam.',
      fact: 'A giant Van de Graaff generator in its Theater of Electricity makes indoor lightning.',
    },
    {
      id: 'mfa',
      draw: art.museumOfFineArts,
      name: 'Museum of Fine Arts',
      shortName: 'MFA',
      owner: 'Fenway',
      address: '465 Huntington Ave',
      x: 233465,
      y: 898853,
      nearestStop: 'museum-of-fine-arts',
      blurb: "One of the country's largest art museums, on Boston's Avenue of the Arts.",
      fact: 'Cyrus Dallin\'s statue "Appeal to the Great Spirit" greets visitors at the front entrance.',
    },
    {
      id: 'coolidge-theatre',
      draw: art.coolidgeCornerTheatre,
      name: 'Coolidge Corner Theatre',
      shortName: 'COOLIDGE',
      owner: 'Brookline',
      address: '290 Harvard St',
      x: 231090,
      y: 899174,
      nearestStop: 'coolidge-corner',
      blurb: 'An Art Deco movie palace showing films in Brookline since 1933.',
      fact: 'Before it became a movie theater, the building was a church.',
    },
    {
      id: 'reservoir',
      draw: art.chestnutHillReservoir,
      name: 'Chestnut Hill Reservoir',
      shortName: 'RESERVOIR',
      owner: 'Brighton',
      address: 'Beacon St',
      x: 228157,
      y: 898348,
      nearestStop: 'south-street',
      blurb: "A peaceful reservoir with a walking loop, built in the 1860s for Boston's water.",
      fact: 'Stone gatehouses from the 1800s still stand on its shore.',
    },
    {
      id: 'gasson-hall',
      draw: art.gassonHall,
      name: 'Gasson Hall',
      shortName: 'GASSON',
      owner: 'Boston College',
      address: 'Chestnut Hill',
      x: 227156,
      y: 898401,
      nearestStop: 'boston-college',
      blurb: "Boston College's Gothic bell tower, a short walk from the end of the B branch.",
      fact: "It was the first building on BC's Chestnut Hill campus.",
    },
    {
      id: 'tufts',
      draw: art.tuftsBallouHall,
      name: 'Tufts University',
      shortName: 'TUFTS',
      owner: 'Medford',
      address: 'Ballou Hall',
      x: 231439,
      y: 906285,
      nearestStop: 'medford-tufts',
      blurb: "A hilltop campus at the very end of the Green Line's E branch.",
      fact: "Tufts' mascot is Jumbo, named after P.T. Barnum's famous circus elephant.",
    },
    ].map(({ draw, ...entry }) => {
    const { rows, colors } = draw();
    return { ...entry, sprite: rows, colors };
  }),
  ...moreLandmarks,
];

export const landmarksById = Object.fromEntries(landmarks.map((l) => [l.id, l]));
