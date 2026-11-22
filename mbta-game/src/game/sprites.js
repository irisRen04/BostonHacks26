// Pixel sprites for the tea game.
//
// Each row is written as run-length tokens: a colour letter, optionally followed by a
// count ("k6" = six k pixels, "." = transparent). `sprite(width, rows)` expands them and
// throws if any row isn't exactly `width` wide, so a miscount fails loudly.

function expand(width, row, index) {
  let out = '';
  for (const tok of row.trim().split(/\s+/)) {
    const count = tok.length > 1 ? parseInt(tok.slice(1), 10) : 1;
    if (!Number.isInteger(count)) throw new Error(`bad token "${tok}" in row ${index}`);
    out += tok[0].repeat(count);
  }
  if (out.length !== width) {
    throw new Error(`sprite row ${index} is ${out.length} wide, expected ${width}: "${row}"`);
  }
  return out;
}

const sprite = (width, rows) => rows.map((r, i) => expand(width, r, i));

/* ------------------------------ colonial patriot (14 x 22) ------------------------------ */

export const PATRIOT_PALETTE = {
  k: '#1b1b2f', // outline
  h: '#2b3a67', // tricorn hat
  g: '#f2c14e', // gold cockade / buttons
  s: '#f0b98d', // skin
  w: '#f4f1ea', // powdered hair / cravat / stockings
  b: '#3a5ba9', // coat
  r: '#c0392b',
  t: '#d6b676',
  n: '#5a3a22', // boots
};

const PATRIOT_HEAD = [
  '.4 k6 .4',
  '.2 k2 h6 k2 .2',
  '.1 k1 h4 g2 h4 k1 .1',
  'k14',
  '.2 k1 w1 s6 w1 k1 .2',
  '.2 k1 w1 s1 k1 s2 k1 s1 w1 k1 .2',
  '.2 k1 w1 s6 w1 k1 .2',
  '.2 k1 w1 s2 r2 s2 w1 k1 .2',
  '.3 k1 s6 k1 .3',
  '.3 k1 w6 k1 .3',
];

const PATRIOT_LEGS = [
  '.3 k1 b6 k1 .3',
  '.3 k1 t2 k2 t2 k1 .3',
  '.3 k1 t2 k2 t2 k1 .3',
  '.3 k1 w2 k2 w2 k1 .3',
  '.3 k1 w2 k2 w2 k1 .3',
  '.2 n4 k2 n4 .2',
];

// arm hanging down
export const PATRIOT_IDLE = sprite(14, [
  ...PATRIOT_HEAD,
  'k1 b3 k1 w4 k1 b3 k1',
  'k1 b3 k1 w1 g2 w1 k1 b3 k1',
  'k1 b3 k1 b1 g2 b1 k1 b3 k1',
  '.1 k1 b2 k1 b1 g2 b1 k1 b2 k1 .1',
  '.1 k1 b1 k1 b6 k1 b1 k1 .1',
  '.1 k1 s1 k1 b6 k1 s1 k1 .1',
  ...PATRIOT_LEGS,
]);

// right arm thrown up and out: the drop leaves from the fist at the top-right
export const PATRIOT_THROW = sprite(14, [
  '.4 k6 .4',
  '.2 k2 h6 k2 .2',
  '.1 k1 h4 g2 h4 k1 .1',
  'k14',
  '.2 k1 w1 s6 w1 k1 .2',
  '.2 k1 w1 s1 k1 s2 k1 s1 w1 k1 .2',
  '.2 k1 w1 s6 w1 k1 s1 k1',
  '.2 k1 w1 s2 r2 s2 w1 k1 b1 k1',
  '.3 k1 s6 k1 b2 k1',
  '.3 k1 w6 k1 b2 k1',
  'k1 b3 k1 w4 k1 b3 k1',
  'k1 b3 k1 w1 g2 w1 k1 b3 k1',
  'k1 b3 k1 b1 g2 b1 k1 b3 k1',
  '.1 k1 b2 k1 b1 g2 b1 k1 b2 k1 .1',
  '.1 k1 b1 k1 b6 k1 .3',
  '.1 k1 s1 k1 b6 k1 .3',
  ...PATRIOT_LEGS,
]);
export const PATRIOT_HAND = { col: 13, row: 6 }; // where the drop leaves, in sprite pixels

/* ------------------------------------ tea drops (7 x 9) ------------------------------------ */

const DROP_ROWS = sprite(7, [
  '.3 o1 .3',
  '.2 o1 f1 o1 .2',
  '.2 o1 f1 o1 .2',
  '.1 o1 f3 o1 .1',
  '.1 o1 f3 o1 .1',
  'o1 f1 h1 f3 o1',
  'o1 f5 o1',
  '.1 o1 f3 o1 .1',
  '.2 o3 .2',
]);

// "tinted" water: strong tea, green tea, and a cool blue-violet infusion
export const DROP_TINTS = [
  { o: '#7a4a14', f: '#d98a2b', h: '#ffd9a0' },
  { o: '#1f6b3a', f: '#5cbf6e', h: '#d6ffd9' },
  { o: '#4a3f9a', f: '#8a7ee0', h: '#e4e0ff' },
];
export const DROP = { rows: DROP_ROWS, scale: 2 };

/* ------------------------------------ teapot (14 x 9) ------------------------------------ */

export const TEAPOT_PALETTE = {
  k: '#1b1b2f',
  d: '#3a2410', // tea inside the open top
  r: '#c0392b',
  p: '#f08a7e', // highlight
  g: '#f2c14e', // gold band
};

export const TEAPOT = sprite(14, [
  '.3 k8 .3',
  '.3 k1 d6 k1 .3',
  '.2 k1 p2 r6 k1 .2',
  'k1 .1 k1 p1 r7 k1 .1 k1',
  'k3 g8 k3',
  '.1 k2 p1 r7 k2 .1',
  '.2 k1 r8 k1 .2',
  '.3 k1 r6 k1 .3',
  '.3 k8 .3',
]);

/* --------------------------- default player, arms raised (12 x 16) --------------------------- */

export const PLAYER_PALETTE = {
  k: '#1b1b2f',
  s: '#f0b98d',
  n: '#6b4226', // hair
  g: '#2f9e5b', // Green Line shirt
  w: '#ffffff',
  u: '#2d3f6b', // jeans
};

export const PLAYER = sprite(12, [
  '.1 s1 .8 s1 .1',
  '.1 s1 .8 s1 .1',
  '.1 g1 .2 k4 .2 g1 .1',
  '.1 g1 .1 k1 n4 k1 .1 g1 .1',
  '.1 g1 .1 k1 k1 s2 k1 k1 .1 g1 .1',
  '.1 g1 .1 k1 s4 k1 .1 g1 .1',
  '.1 g1 .2 k1 s2 k1 .2 g1 .1',
  '.2 g1 k1 g4 k1 g1 .2',
  '.3 g2 w2 g2 .3',
  '.3 g6 .3',
  '.3 n6 .3',
  '.3 u6 .3',
  '.3 u2 .2 u2 .3',
  '.3 u2 .2 u2 .3',
  '.3 u2 .2 u2 .3',
  '.2 n3 .2 n3 .2',
]);
