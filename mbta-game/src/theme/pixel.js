// Pixel-art look for the transit game: palette, fonts, sprites, and a tiny
// rasterizer that turns track polylines into chunky screen-space pixels.

export const FONT_TITLE = 'PressStart2P_400Regular';
export const FONT_BODY = 'VT323_400Regular';

export const PX = 4; // size of one map "pixel" in screen points

export const PALETTE = {
  ink: '#1b1b2f', // outlines, text
  night: '#262b44', // UI panels
  panelEdge: '#f4f4f4',
  ground: '#cfd8a3',
  water: '#3a6ea5',
  waterLight: '#6fa3d6', // wave highlights
  waterDeep: '#2f5d8f',
  shore: '#e2d3a0', // sandy bank along the water's edge
  park: '#a9c46f',
  parkEdge: '#7d9e4f', // hedge around parks
  tree: '#4f7a35',
  treeLight: '#8fbf5a',
  groundDark: '#bfca8f',
  groundSpeck: '#a9b878',
  white: '#f4f4f4',
  gold: '#ffd23f',
  green: '#1f9d55', // Green Line fill
  greenLight: '#5fd17f', // top-edge highlight
  greenDark: '#0b4d2a', // outline
  red: '#d9413b',
  orange: '#f08a24',
  blue: '#3863c9',
  silver: '#8b9bb4',
};

export const LINE_PIXEL_COLORS = {
  Red: PALETTE.red,
  Orange: PALETTE.orange,
  Blue: PALETTE.blue,
  Silver: PALETTE.silver,
};

// ---- sprites: each character is one pixel, '.' is transparent

const SPRITE_KEY = {
  K: PALETTE.ink,
  W: PALETTE.white,
  G: PALETTE.green,
  L: PALETTE.greenLight,
  D: PALETTE.greenDark,
  Y: PALETTE.gold,
  S: '#9aa3b5',
};

/** Bullseye stop icon (close-up). Transfer stations swap the outer white ring for gold. */
export const STOP_SPRITE = [
  '..KKKKK..',
  '.KWWWWWK.',
  'KWWGGGWWK',
  'KWGWWWGWK',
  'KWGWGWGWK',
  'KWGWWWGWK',
  'KWWGGGWWK',
  '.KWWWWWK.',
  '..KKKKK..',
];
export const TRANSFER_SPRITE = [
  '..KKKKK..',
  '.KYYYYYK.',
  'KYWGGGWYK',
  'KYGWWWGYK',
  'KYGWGWGYK',
  'KYGWWWGYK',
  'KYWGGGWYK',
  '.KYYYYYK.',
  '..KKKKK..',
];

/** Bullseye for zoomed-out views. */
export const STOP_SPRITE_SMALL = ['.KKK.', 'KWWWK', 'KWGWK', 'KWWWK', '.KKK.'];
export const TRANSFER_SPRITE_SMALL = ['.KKK.', 'KYYYK', 'KYGYK', 'KYYYK', '.KKK.'];

/**
 * A live Green Line train in an HD-2D spirit: a two-section articulated light-rail
 * car (side view, front on the RIGHT) with a pantograph, lit roof, glass
 * reflections, doors, a dark skirt and wheel trucks. Built from a layout so every
 * row is exactly the same width.
 */
function buildTrain() {
  const SECTION = 11; // body columns per car section
  const W = 1 + SECTION + 2 + SECTION + 1; // outline + rear car + bellows + front car + outline
  const rows = [];
  const row = (fn) => rows.push(Array.from({ length: W }, (_, x) => fn(x)).join(''));
  const frontStart = 1 + SECTION + 2;
  const inBellows = (x) => x === 1 + SECTION || x === 2 + SECTION;
  // within one section: windows with a glass glint, then a door next to the bellows
  const sec = (x) => (x < frontStart ? x - 1 : x - frontStart);
  const cell = (x, kind) => {
    if (x === 0 || x === W - 1) return 'K';
    if (inBellows(x)) return 'K';
    const i = x < frontStart ? SECTION - 1 - sec(x) : sec(x); // mirror so doors sit by the bellows
    return kind(i);
  };
  // pantograph (diamond frame) over the front car
  const panto = frontStart + 4;
  row((x) => (x >= panto - 2 && x <= panto + 2 ? 'P' : '.'));
  row((x) => (x === panto - 1 || x === panto + 1 ? 'P' : '.'));
  row((x) => (x === panto ? 'P' : '.'));
  row((x) => (x === 0 || x === W - 1 ? '.' : 'K')); // roof outline, rounded corners
  row((x) => cell(x, () => 'L')); // rim-lit roof
  row((x) => cell(x, (i) => (i === 0 ? 'D' : i % 4 === 1 ? 'G' : i % 4 === 2 ? 'R' : 'W')));
  row((x) => cell(x, (i) => (i === 0 ? 'D' : i % 4 === 1 ? 'G' : 'W')));
  row((x) => cell(x, (i) => (i === 0 ? 'D' : 'G')));
  row((x) => cell(x, (i) => (i === 0 ? 'D' : 'H'))); // shaded lower body
  row((x) => (x === W - 2 ? 'Y' : x === 1 ? 'r' : cell(x, () => 'B'))); // skirt, headlight front, tail light back
  row((x) => (x === 0 || x === W - 1 ? '.' : 'K'));
  // wheel trucks under each section
  const trucks = [3, 4, 9, 10].flatMap((c) => [c, frontStart + c - 1]);
  row((x) => (trucks.includes(x) ? 'w' : '.'));
  return rows;
}

export const TRAIN_SPRITE = buildTrain();

export const TRAIN_COLORS = {
  K: PALETTE.ink,
  P: '#8b93a8', // pantograph
  L: '#7fe0a0', // roof catching the light
  G: '#1f9d55', // Green Line body
  H: '#178048', // body in shade
  W: '#2b3a55', // window glass
  R: '#bfe6ff', // glint on the glass
  D: '#0f6b3a', // doors
  B: '#0b4d2a', // skirt
  Y: '#fff3b0', // headlight
  r: '#ff5d5d', // tail light
  w: '#2a2d3a', // wheels
};

/** Where the headlight is, in sprite pixels from the sprite's top-left. */
export const TRAIN_HEADLIGHT = { col: TRAIN_SPRITE[0].length - 2, row: TRAIN_SPRITE.findIndex((r) => r.includes('Y')) };

/**
 * Add a sprite to per-colour cell buckets. (cx, cy) is the sprite's center in
 * screen points, `s` the size of one sprite pixel, and `colors` maps sprite
 * characters to colours.
 */
export function stampSprite(buckets, sprite, cx, cy, s, colors = SPRITE_KEY) {
  const h = sprite.length;
  const w = sprite[0].length;
  const x0 = Math.round(cx - (w * s) / 2);
  const y0 = Math.round(cy - (h * s) / 2);
  for (let y = 0; y < h; y++) {
    const row = sprite[y];
    for (let x = 0; x < w; x++) {
      const color = colors[row[x]];
      if (!color) continue;
      (buckets[color] ??= []).push([x0 + x * s, y0 + y * s, s]);
    }
  }
}

/** One SVG path string for many same-coloured squares: [[x, y, size], ...]. */
export function squaresToPath(squares) {
  let d = '';
  for (const [x, y, s] of squares) d += `M${x} ${y}h${s}v${s}h${-s}z`;
  return d;
}

// ---- track rasterizer

const key = (gx, gy) => gx * 100003 + gy; // grid coords stay well under 1e5

/**
 * Rasterize polylines (already in screen points) onto a PX grid anchored at (ox, oy).
 * Returns a Map of cell key -> [gx, gy] for cells within `brush` cells of the line.
 */
export function rasterize(polylines, brush, ox, oy, width, height) {
  const cells = new Map();
  const r = Math.floor(brush / 2);
  const maxGX = Math.ceil(width / PX) + 2;
  const maxGY = Math.ceil(height / PX) + 2;
  const put = (gx, gy) => {
    for (let dx = -r; dx < brush - r; dx++) {
      for (let dy = -r; dy < brush - r; dy++) {
        const x = gx + dx;
        const y = gy + dy;
        if (x < -2 || y < -2 || x > maxGX || y > maxGY) continue;
        const k = key(x, y);
        if (!cells.has(k)) cells.set(k, [x, y]);
      }
    }
  };
  for (const pts of polylines) {
    for (let i = 1; i < pts.length; i++) {
      const ax = (pts[i - 1][0] - ox) / PX;
      const ay = (pts[i - 1][1] - oy) / PX;
      const bx = (pts[i][0] - ox) / PX;
      const by = (pts[i][1] - oy) / PX;
      // skip segments entirely off screen
      if ((ax < -4 && bx < -4) || (ay < -4 && by < -4) || (ax > maxGX + 4 && bx > maxGX + 4) || (ay > maxGY + 4 && by > maxGY + 4)) continue;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 1.5));
      for (let t = 0; t <= steps; t++) {
        put(Math.floor(ax + ((bx - ax) * t) / steps), Math.floor(ay + ((by - ay) * t) / steps));
      }
    }
  }
  return cells;
}

/** Path for a set of grid cells, merging horizontal runs into single rectangles. */
export function cellsToPath(cells, ox, oy) {
  const rows = new Map();
  for (const [gx, gy] of cells.values()) {
    let row = rows.get(gy);
    if (!row) rows.set(gy, (row = []));
    row.push(gx);
  }
  let d = '';
  for (const [gy, xs] of rows) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    const flush = () => {
      const x = ox + start * PX;
      const y = oy + gy * PX;
      d += `M${x} ${y}h${(prev - start + 1) * PX}v${PX}h${-(prev - start + 1) * PX}z`;
    };
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] === prev + 1) {
        prev = xs[i];
      } else {
        flush();
        start = prev = xs[i];
      }
    }
    flush();
  }
  return d;
}

/** Cells on the top edge of a shape (nothing directly above) — used for a bevel highlight. */
export function topEdge(cells) {
  const out = new Map();
  for (const [k, [gx, gy]] of cells) {
    if (!cells.has(key(gx, gy - 1))) out.set(k, [gx, gy]);
  }
  return out;
}

/**
 * Fill polygons (screen points; outer rings and island rings together, even-odd
 * rule) onto the PX grid anchored at (ox, oy). Scans one grid row at a time and
 * returns a single SVG path made of horizontal runs.
 */
export function fillRings(rings, ox, oy, width, height) {
  const maxGX = Math.ceil(width / PX) + 1;
  const maxGY = Math.ceil(height / PX) + 1;
  // only rings whose box is on screen take part
  const edges = [];
  for (const ring of rings) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxX < 0 || maxY < 0 || minX > width || minY > height) continue; // can't touch the screen
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (a[1] === b[1]) continue;
      edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]);
    }
  }
  if (!edges.length) return '';
  let d = '';
  const xs = [];
  for (let gy = -1; gy <= maxGY; gy++) {
    const yc = oy + (gy + 0.5) * PX;
    xs.length = 0;
    for (const [x0, y0, x1, y1] of edges) {
      if (yc < y0 || yc >= y1) continue;
      xs.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const g0 = Math.max(-1, Math.round((xs[i] - ox) / PX));
      const g1 = Math.min(maxGX, Math.round((xs[i + 1] - ox) / PX));
      if (g1 <= g0) continue;
      const x = ox + g0 * PX;
      const w = (g1 - g0) * PX;
      d += `M${x} ${oy + gy * PX}h${w}v${PX}h${-w}z`;
    }
  }
  return d;
}
