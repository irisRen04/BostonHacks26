// Pixel art for the landmarks, drawn with a tiny canvas so every sprite is an
// exact grid. Each drawing returns { rows, colors }: rows are strings where each
// character is one pixel ('.' = transparent) and colors maps characters to hex.
import { PALETTE } from '../theme/pixel';

const INK = PALETTE.ink;

function canvas(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const c = {
    px(x, y, ch) {
      if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = ch;
      return c;
    },
    rect(x, y, rw, rh, ch) {
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) c.px(x + i, y + j, ch);
      return c;
    },
    hline: (x, y, len, ch) => c.rect(x, y, len, 1, ch),
    vline: (x, y, len, ch) => c.rect(x, y, 1, len, ch),
    /** Filled rectangle with a 1px outline. */
    box(x, y, rw, rh, fill, line = 'K') {
      c.rect(x, y, rw, rh, line);
      if (rw > 2 && rh > 2) c.rect(x + 1, y + 1, rw - 2, rh - 2, fill);
      return c;
    },
    /** Half-disc sitting on row `base`, centred on column cx, outlined. */
    dome(cx, base, r, fill, line = 'K') {
      const pts = new Set();
      for (let y = base - r; y <= base; y++) {
        const half = Math.floor(Math.sqrt(r * r - (base - y) ** 2) + 0.35);
        for (let x = cx - half; x <= cx + half; x++) pts.add(`${x},${y}`);
      }
      for (const p of pts) {
        const [x, y] = p.split(',').map(Number);
        const edge = y === base || !pts.has(`${x - 1},${y}`) || !pts.has(`${x + 1},${y}`) || !pts.has(`${x},${y - 1}`);
        c.px(x, y, edge ? line : fill);
      }
      return c;
    },
    /** Triangle roof/pediment: apex at (cx, top), growing `step` px per side per row, `rowsTall` rows. */
    roof(cx, top, rowsTall, fill, step = 1, line = 'K') {
      for (let r = 0; r < rowsTall; r++) {
        const half = r * step;
        for (let x = cx - half; x <= cx + half; x++) {
          const edge = x === cx - half || x === cx + half || r === rowsTall - 1;
          c.px(x, top + r, edge ? line : fill);
        }
      }
      return c;
    },
    /** Window with a rounded (arched) top. */
    arch(x, y, rw, rh, fill) {
      c.rect(x, y + 1, rw, rh - 1, fill);
      if (rw >= 3) c.hline(x + 1, y, rw - 2, fill);
      else c.hline(x, y, rw, fill);
      return c;
    },
    rows: () => g.map((r) => r.join('')),
  };
  return c;
}

export function fenwayPark() {
  const c = canvas(24, 18);
  for (const tx of [1, 19]) {
    c.box(tx, 0, 4, 3, 'Y'); // light bank
    c.vline(tx + 1, 3, 4, 'S');
    c.vline(tx + 2, 3, 4, 'S');
  }
  c.box(0, 7, 24, 9, 'G'); // the Green Monster
  c.hline(1, 8, 22, 'H');
  c.box(8, 9, 9, 5, 'D'); // manual scoreboard
  for (const [x, y] of [[10, 10], [10, 12], [12, 10], [12, 11], [12, 12], [14, 10], [15, 10], [15, 11], [14, 12], [15, 12]]) c.px(x, y, 'W');
  c.hline(0, 16, 24, 'N'); // warning track
  c.hline(0, 17, 24, 'T'); // grass
  return {
    rows: c.rows(),
    colors: { K: INK, Y: '#ffe680', S: '#6b7393', G: '#2f6b3d', H: '#3f8a50', D: '#173d22', W: '#f4f4f4', N: '#b07a4a', T: '#4caf50' },
  };
}

export function bostonPublicLibrary() {
  const c = canvas(24, 17);
  c.hline(2, 0, 20, 'K');
  c.px(1, 1, 'K').hline(2, 1, 20, 'R').px(22, 1, 'K');
  c.px(0, 2, 'K').hline(1, 2, 22, 'R').px(23, 2, 'K');
  c.box(0, 3, 24, 14, 'S');
  c.hline(1, 4, 22, 'E'); // cornice
  for (let i = 0; i < 7; i++) c.arch(2 + i * 3, 6, 2, 4, 'D'); // arcade of library windows
  for (const x of [7, 11, 15]) c.arch(x, 11, 3, 5, 'D'); // three arched entrances
  return { rows: c.rows(), colors: { K: INK, R: '#b5583a', S: '#d9cfbd', E: '#bfb39d', D: '#3a3550' } };
}

export function stateHouse() {
  const c = canvas(21, 20);
  c.dome(10, 8, 6, 'Y'); // the gold dome
  c.px(7, 5, 'L').px(7, 6, 'L').px(8, 4, 'L'); // shine
  c.box(9, 1, 3, 3, 'W'); // lantern
  c.px(10, 0, 'Y');
  c.px(3, 9, 'K').hline(4, 9, 13, 'W').px(17, 9, 'K'); // drum
  c.roof(10, 10, 3, 'W', 2); // pediment
  c.box(0, 12, 21, 8, 'N'); // brick
  c.rect(5, 13, 11, 6, 'D'); // portico shadow
  for (let x = 5; x <= 15; x += 2) c.vline(x, 13, 6, 'W'); // white columns
  c.hline(5, 13, 11, 'W');
  c.rect(2, 14, 2, 3, 'D').rect(17, 14, 2, 3, 'D');
  return { rows: c.rows(), colors: { K: INK, Y: '#f2c230', L: '#ffe58a', W: '#f4f4f4', N: '#a8452f', D: '#4a3a3a' } };
}

export function museumOfScience() {
  const c = canvas(24, 16);
  c.dome(6, 6, 4, 'W'); // planetarium
  for (const [x, y] of [[19, 0], [20, 0], [18, 1], [19, 1], [17, 2], [18, 2], [19, 2], [20, 2], [19, 3], [18, 4], [17, 5]]) c.px(x, y, 'Y'); // lightning bolt
  c.box(0, 6, 24, 10, 'C');
  c.rect(1, 8, 22, 3, 'B'); // glass band
  c.hline(1, 8, 22, 'M');
  for (let x = 4; x < 23; x += 4) c.vline(x, 8, 3, 'K');
  c.rect(10, 12, 4, 3, 'D'); // entrance
  return { rows: c.rows(), colors: { K: INK, W: '#f4f4f4', Y: '#ffd23f', C: '#cfd4dc', B: '#6fa8dc', M: '#a9cbe8', D: '#3a4660' } };
}

export function gassonHall() {
  const c = canvas(15, 26);
  for (let r = 0; r < 6; r++) {
    const half = Math.floor(r / 2);
    for (let x = 7 - half; x <= 7 + half; x++) c.px(x, r, x === 7 - half || x === 7 + half ? 'K' : 'S'); // spire
  }
  c.px(4, 4, 'K').px(4, 5, 'K').px(10, 4, 'K').px(10, 5, 'K'); // corner pinnacles
  c.box(4, 6, 7, 14, 'S'); // bell tower
  c.arch(6, 8, 3, 6, 'D');
  c.px(7, 16, 'D');
  c.box(0, 18, 15, 8, 'S'); // main hall
  c.arch(2, 20, 2, 4, 'D').arch(11, 20, 2, 4, 'D');
  c.arch(6, 20, 3, 5, 'D'); // doorway
  return { rows: c.rows(), colors: { K: INK, S: '#c9b99a', D: '#3d3a4a' } };
}

export function coolidgeCornerTheatre() {
  const c = canvas(20, 20);
  c.box(9, 1, 6, 3, 'A'); // stepped Art Deco top
  c.box(4, 3, 16, 17, 'A');
  c.vline(8, 4, 7, 'E').vline(15, 4, 7, 'E');
  c.box(0, 0, 4, 14, 'R'); // vertical blade sign
  for (let y = 1; y < 13; y += 2) c.px(1, y, 'Y').px(2, y + 1, 'Y');
  c.box(4, 11, 16, 4, 'W'); // marquee
  for (let x = 4; x < 20; x += 2) c.px(x, 11, 'Y').px(x, 14, 'Y');
  for (const x of [6, 7, 10, 13, 14, 17]) c.px(x, 12, 'K'); // a few letters of marquee text
  for (const x of [8, 11, 12, 16]) c.px(x, 13, 'K');
  c.rect(9, 16, 6, 3, 'D'); // doors
  c.vline(12, 16, 3, 'K');
  return { rows: c.rows(), colors: { K: INK, A: '#e8d9b5', E: '#c9b98f', R: '#b8292f', Y: '#ffd23f', W: '#f4f4f4', D: '#3a4660' } };
}

export function chestnutHillReservoir() {
  const c = canvas(24, 12);
  const tree = (x0) => {
    c.hline(x0 + 1, 0, 3, 'K');
    c.px(x0, 1, 'K').hline(x0 + 1, 1, 3, 'T').px(x0 + 4, 1, 'K');
    c.px(x0, 2, 'K').hline(x0 + 1, 2, 3, 'T').px(x0 + 4, 2, 'K');
    c.hline(x0 + 1, 3, 3, 'K');
    c.px(x0 + 2, 4, 'N');
  };
  tree(0);
  tree(19);
  c.roof(11, 0, 2, 'R', 2); // gatehouse roof
  c.box(9, 1, 5, 4, 'S');
  c.px(11, 3, 'D');
  c.hline(0, 5, 24, 'G'); // shoreline
  c.rect(0, 6, 24, 6, 'B'); // water
  for (let y = 7; y < 12; y += 2) for (let x = (y * 3) % 6; x < 24; x += 6) c.px(x, y, 'L').px(x + 1, y, 'L');
  return { rows: c.rows(), colors: { K: INK, T: '#3f8a50', N: '#7a5230', R: '#8a4a3a', S: '#b8a88a', D: '#3d3a4a', G: '#7fbf5f', B: '#3f7cc0', L: '#a9d2f5' } };
}

export function museumOfFineArts() {
  const c = canvas(25, 16);
  c.dome(12, 3, 3, 'C'); // rotunda dome
  c.box(0, 5, 25, 11, 'S');
  c.roof(12, 3, 3, 'S', 2); // pediment, below the dome
  c.rect(7, 6, 11, 8, 'D'); // portico shadow
  for (let x = 7; x <= 17; x += 2) c.vline(x, 6, 8, 'P'); // columns
  c.rect(2, 8, 2, 3, 'D').rect(21, 8, 2, 3, 'D');
  c.hline(5, 14, 15, 'E'); // steps
  return { rows: c.rows(), colors: { K: INK, C: '#8fa8a0', S: '#d9cfbd', P: '#efe8da', D: '#5b5566', E: '#bfb39d' } };
}

export function tuftsBallouHall() {
  const c = canvas(19, 20);
  c.px(9, 0, 'K');
  c.box(8, 1, 3, 4, 'W'); // cupola
  c.hline(6, 5, 7, 'K');
  c.px(5, 6, 'K').hline(6, 6, 7, 'R').px(13, 6, 'K');
  c.px(3, 7, 'K').hline(4, 7, 11, 'R').px(15, 7, 'K');
  c.box(1, 8, 17, 12, 'N');
  for (const x of [3, 6, 11, 14]) c.rect(x, 10, 2, 3, 'D').rect(x, 15, 2, 3, 'D');
  c.hline(7, 13, 5, 'W');
  c.rect(8, 14, 3, 5, 'D'); // door
  return { rows: c.rows(), colors: { K: INK, W: '#f4f4f4', R: '#5b6170', N: '#8a5a44', D: '#2f3550' } };
}

export function tdGarden() {
  const c = canvas(26, 14);
  c.box(0, 2, 26, 12, 'A');
  c.hline(1, 3, 24, 'G'); // green trim
  c.box(8, 0, 10, 4, 'Y'); // big screen
  c.rect(3, 5, 20, 5, 'B'); // glass front
  c.hline(3, 5, 20, 'M');
  for (let x = 6; x < 23; x += 4) c.vline(x, 5, 5, 'K');
  c.rect(10, 10, 6, 3, 'D'); // entrance
  return { rows: c.rows(), colors: { K: INK, A: '#3d4458', G: '#1f9d55', Y: '#ffd23f', B: '#6fa8dc', M: '#a9cbe8', D: '#1b1f33' } };
}

export function faneuilHall() {
  const c = canvas(19, 22);
  c.px(9, 0, 'Y').px(10, 0, 'Y').px(8, 0, 'Y'); // the golden grasshopper weathervane
  c.px(9, 1, 'K');
  c.box(8, 2, 3, 5, 'W'); // cupola
  c.hline(5, 7, 9, 'K');
  c.px(4, 8, 'K').hline(5, 8, 9, 'R').px(14, 8, 'K');
  c.px(2, 9, 'K').hline(3, 9, 13, 'R').px(16, 9, 'K');
  c.box(0, 10, 19, 12, 'N');
  c.hline(1, 11, 17, 'W'); // cornice
  for (const x of [2, 5, 12, 15]) c.arch(x, 13, 2, 3, 'D').arch(x, 17, 2, 3, 'D');
  c.arch(8, 16, 3, 5, 'D'); // door
  return { rows: c.rows(), colors: { K: INK, Y: '#f2c230', W: '#f4f4f4', R: '#4a5068', N: '#a8452f', D: '#2f3550' } };
}

export function prudentialTower() {
  const c = canvas(13, 30);
  c.vline(6, 0, 4, 'K'); // antenna
  c.box(3, 4, 7, 3, 'L'); // crown
  c.box(2, 6, 9, 21, 'S');
  for (let x = 3; x <= 9; x += 2) c.vline(x, 7, 19, 'B'); // window stripes
  c.box(0, 25, 13, 5, 'S'); // podium
  c.rect(5, 27, 3, 2, 'D');
  return { rows: c.rows(), colors: { K: INK, L: '#d0d6de', S: '#a9b1bd', B: '#5b7fa8', D: '#2f3550' } };
}

export function swanBoats() {
  const c = canvas(24, 12);
  c.rect(0, 7, 24, 5, 'B'); // lagoon
  for (let y = 8; y < 12; y += 2) for (let x = (y * 5) % 6; x < 24; x += 6) c.px(x, y, 'L').px(x + 1, y, 'L');
  c.box(3, 6, 15, 3, 'G'); // boat hull
  for (const x of [5, 8, 11, 14]) c.rect(x, 4, 2, 2, 'D'); // benches
  // the swan at the back
  c.box(15, 3, 6, 5, 'W');
  c.vline(19, 0, 4, 'W').vline(18, 0, 4, 'K').vline(20, 1, 3, 'K');
  c.px(19, 0, 'W').px(20, 0, 'K').px(21, 1, 'O');
  c.hline(16, 5, 3, 'E');
  return { rows: c.rows(), colors: { K: INK, B: '#3f7cc0', L: '#a9d2f5', G: '#1f9d55', D: '#7a5230', W: '#f4f4f4', E: '#d5dbe4', O: '#f08a24' } };
}
