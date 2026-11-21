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

/** The rider: a little Green Line trolley that sits above the current stop. */
export const TROLLEY_SPRITE = [
  '....KKK....',
  '.....K.....',
  'KKKKKKKKKKK',
  'KLLLLLLLLLK',
  'KGWWGWGWWGK',
  'KGWWGWGWWGK',
  'KGGGGGGGGGK',
  'KYGGGGGGGYK',
  'KKKKKKKKKKK',
  '.KSK...KSK.',
  '..K.....K..',
];

/**
 * Add a sprite to per-colour cell buckets. (cx, cy) is the sprite's center in
 * screen points and `s` the size of one sprite pixel.
 */
export function stampSprite(buckets, sprite, cx, cy, s) {
  const h = sprite.length;
  const w = sprite[0].length;
  const x0 = Math.round(cx - (w * s) / 2);
  const y0 = Math.round(cy - (h * s) / 2);
  for (let y = 0; y < h; y++) {
    const row = sprite[y];
    for (let x = 0; x < w; x++) {
      const color = SPRITE_KEY[row[x]];
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
