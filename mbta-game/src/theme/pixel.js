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
 * A live Green Line train seen from above, pointing RIGHT (+x): a two-section
 * articulated car with side windows along both edges, a windshield at each end
 * (headlights in the front corners, tail lights at the back), a ribbed rubber
 * bellows in the middle, AC units with grilles and roof vents on the rear car,
 * and a pantograph on the front car. Built from a layout so every row is the same width.
 */
function buildTrain() {
  const SECTION = 13; // body columns per car section
  const H = 11; // rows: outline, windows, lit edge, 5 roof rows, shaded edge, windows, outline
  const W = 1 + SECTION + 2 + SECTION + 1;
  const front = 1 + SECTION + 2; // first column of the front car
  const mid = Math.floor(H / 2);
  const grid = [];
  for (let y = 0; y < H; y++) {
    const line = [];
    for (let x = 0; x < W; x++) {
      const edgeRow = y === 0 || y === H - 1;
      const endCol = x === 0 || x === W - 1;
      let c;
      if (edgeRow || endCol) c = (edgeRow && endCol) ? '.' : 'K';
      else if (x === 1 + SECTION || x === 2 + SECTION) c = y % 2 ? 'b' : 'K'; // ribbed bellows
      else {
        const rear = x < front;
        const i = rear ? x - 1 : x - front; // column within its section
        const atFrontEnd = !rear && i >= SECTION - 2;
        const atRearEnd = rear && i <= 1;
        if (atFrontEnd || atRearEnd) {
          // cab: windshield, with head/tail lights in the corners
          if (y === 1 || y === H - 2) c = atFrontEnd ? (i === SECTION - 1 ? 'Y' : 'S') : i === 0 ? 'r' : 'S';
          else c = y === 3 && (atFrontEnd ? i === SECTION - 2 : i === 1) ? 'R' : 'S';
        } else if (y === 1 || y === H - 2) {
          // side windows: panes with frames between, a glint on the top side
          c = i % 3 === 2 ? 'F' : y === 1 ? (i % 3 === 0 ? 'R' : 'W') : 'w';
        } else if (y === 2) c = 'L'; // sunlit roof edge
        else if (y === H - 3) c = 'H'; // roof edge in shade
        else if (rear && i >= 3 && i <= 6) c = (y === 3 || y === H - 4) ? 'A' : 'a'; // AC unit + grille
        else if (rear && i === 9 && (y === 4 || y === H - 5)) c = 'v'; // roof vents
        else if (!rear && Math.abs(i - 6) + Math.abs(y - mid) <= 2) c = Math.abs(i - 6) + Math.abs(y - mid) === 2 ? 'P' : 'G'; // pantograph diamond
        else c = y === mid ? 'g' : 'G'; // roof, with a shaded seam down the middle
      }
      line.push(c);
    }
    grid.push(line.join(''));
  }
  return grid;
}

export const TRAIN_SPRITE = buildTrain();

export const TRAIN_COLORS = {
  K: PALETTE.ink,
  b: '#3a3f5c', // bellows ribs
  L: '#7fe0a0', // roof edge catching the light
  G: '#1f9d55', // Green Line roof
  g: '#1a8a4a', // roof seam
  H: '#178048', // roof edge in shade
  W: '#2b3a55', // window glass (sunny side)
  w: '#222b40', // window glass (shady side)
  R: '#bfe6ff', // glint on glass
  F: '#e9eef2', // window frames
  S: '#1e2638', // windshields
  A: '#c9cfe0', // AC unit
  a: '#9aa3b8', // AC grille
  v: '#6b7393', // roof vent
  P: '#8b93a8', // pantograph frame
  Y: '#fff3b0', // headlights
  r: '#ff5d5d', // tail lights
};

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
 * rule) onto the PX grid anchored at (ox, oy). Returns a single SVG path made of
 * horizontal runs, one grid row at a time.
 *
 * Kept fast for zoomed-out views: rings smaller than a pixel or off screen are
 * skipped, points closer together than half a pixel are merged, and each row only
 * looks at the edges that actually cross it (an edge list sorted by row).
 */
export function fillRings(rings, ox, oy, width, height) {
  const maxGX = Math.ceil(width / PX) + 1;
  const maxGY = Math.ceil(height / PX) + 1;
  const rows = maxGY + 2; // grid rows -1 .. maxGY
  const startAt = Array.from({ length: rows }, () => []); // edges grouped by first row they cross
  const minStep = PX / 2;
  let any = false;
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
    if (maxX - minX < PX * 0.75 && maxY - minY < PX * 0.75) continue; // smaller than a pixel
    // merge points that land within half a pixel of the last kept one
    const pts = [];
    for (const p of ring) {
      const last = pts[pts.length - 1];
      if (!last || Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) >= minStep) pts.push(p);
    }
    if (pts.length < 3) continue;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (a[1] === b[1]) continue;
      const [x0, y0, x1, y1] = a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]];
      // grid rows whose centre line (oy + (gy + 0.5) * PX) lies in [y0, y1)
      const first = Math.max(-1, Math.ceil((y0 - oy) / PX - 0.5));
      const last = Math.min(maxGY, Math.ceil((y1 - oy) / PX - 0.5) - 1);
      if (last < first) continue;
      startAt[first + 1].push({ x0, y0, slope: (x1 - x0) / (y1 - y0), last });
      any = true;
    }
  }
  if (!any) return '';
  let d = '';
  let active = [];
  const xs = [];
  for (let gy = -1; gy <= maxGY; gy++) {
    const yc = oy + (gy + 0.5) * PX;
    if (startAt[gy + 1].length) active = active.concat(startAt[gy + 1]);
    if (!active.length) continue;
    xs.length = 0;
    let keep = 0;
    for (const e of active) {
      xs.push(e.x0 + (yc - e.y0) * e.slope);
      if (e.last > gy) active[keep++] = e; // still crosses the next row
    }
    active.length = keep;
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const g0 = Math.max(-1, Math.round((xs[i] - ox) / PX));
      const g1 = Math.min(maxGX, Math.round((xs[i + 1] - ox) / PX));
      if (g1 <= g0) continue;
      const w = (g1 - g0) * PX;
      d += `M${ox + g0 * PX} ${oy + gy * PX}h${w}v${PX}h${-w}z`;
    }
  }
  return d;
}
