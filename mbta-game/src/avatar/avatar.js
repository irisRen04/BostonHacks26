// Customizable pixel avatar: the options a rider can pick, and how a choice of
// options is turned into a 12x16 sprite.
import { PALETTE } from '../theme/pixel';

// ---- options shown in the Customize screen, in order

const SKIN = [
  { id: 'light', label: 'Light', color: '#f6d2b0' },
  { id: 'tan', label: 'Tan', color: '#e0a676' },
  { id: 'brown', label: 'Brown', color: '#a96a42' },
  { id: 'deep', label: 'Deep', color: '#6b3f24' },
];

const HAIR_COLORS = [
  { id: 'black', label: 'Black', color: '#2a1d14' },
  { id: 'brown', label: 'Brown', color: '#6b3e1f' },
  { id: 'blonde', label: 'Blonde', color: '#d9a443' },
  { id: 'red', label: 'Red', color: '#c8452f' },
  { id: 'purple', label: 'Purple', color: '#7a4fd1' },
  { id: 'silver', label: 'Silver', color: '#e3e3e3' },
];

// Clothes come in T line colours.
const LINE_COLOURS = [
  { id: 'green', label: 'Green Line', color: PALETTE.green },
  { id: 'red', label: 'Red Line', color: PALETTE.red },
  { id: 'orange', label: 'Orange Line', color: PALETTE.orange },
  { id: 'blue', label: 'Blue Line', color: PALETTE.blue },
  { id: 'silver', label: 'Silver Line', color: PALETTE.silver },
  { id: 'pink', label: 'Pink', color: '#e86aa6' },
];

const HAIR_STYLES = [
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'bun', label: 'Bun' },
  { id: 'buzz', label: 'Buzz' },
  { id: 'none', label: 'None' },
];

const HATS = [
  { id: 'none', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'crown', label: 'Crown' },
];

const GLASSES = [
  { id: 'none', label: 'None' },
  { id: 'glasses', label: 'Glasses' },
];

export const AVATAR_OPTIONS = [
  { key: 'skin', label: 'SKIN', choices: SKIN },
  { key: 'hair', label: 'HAIR', choices: HAIR_STYLES },
  { key: 'hairColor', label: 'HAIR COLOR', choices: HAIR_COLORS },
  { key: 'shirt', label: 'SHIRT', choices: LINE_COLOURS },
  { key: 'hat', label: 'HAT', choices: HATS },
  { key: 'hatColor', label: 'HAT COLOR', choices: LINE_COLOURS },
  { key: 'glasses', label: 'GLASSES', choices: GLASSES },
];

export const DEFAULT_AVATAR = {
  skin: 'tan',
  hair: 'short',
  hairColor: 'brown',
  shirt: 'green',
  hat: 'cap',
  hatColor: 'green',
  glasses: 'none',
};

/** Keep only known keys/values, so old or broken saved data can't crash the sprite. */
export function sanitizeAvatar(raw) {
  const out = { ...DEFAULT_AVATAR };
  for (const { key, choices } of AVATAR_OPTIONS) {
    if (raw && choices.some((c) => c.id === raw[key])) out[key] = raw[key];
  }
  return out;
}

export function randomAvatar() {
  const out = {};
  for (const { key, choices } of AVATAR_OPTIONS) out[key] = choices[Math.floor(Math.random() * choices.length)].id;
  return out;
}

const pick = (key, id) => AVATAR_OPTIONS.find((o) => o.key === key).choices.find((c) => c.id === id);

// ---- sprite layers. Each layer only overwrites its non-'.' pixels.
// O outline, S skin, E eye, M mouth, H hair, T shirt, P pants, B shoes, C hat, W white, Y gold

const BODY = [
  '............',
  '............',
  '...OOOOOO...',
  '..OSSSSSSO..',
  '..OSSSSSSO..',
  '..OSESSESO..',
  '..OSSSSSSO..',
  '..OSSMMSSO..',
  '...OOSSOO...',
  '..OOTTTTOO..',
  '.OTTTTTTTTO.',
  '.OSOTTTTOSO.',
  '.OOOTTTTOOO.',
  '...OPPPPO...',
  '...OPOOPO...',
  '...OBO.OBO..',
];

const HAIR_LAYERS = {
  none: [],
  buzz: [[3, '..OHHHHHHO..']],
  short: [
    [1, '...OOOOOO...'],
    [2, '..OHHHHHHO..'],
    [3, '..OHHHHHHO..'],
    [4, '...H....H...'],
  ],
  long: [
    [1, '...OOOOOO...'],
    [2, '..OHHHHHHO..'],
    [3, '.OHHHHHHHHO.'],
    [4, '.OHH....HHO.'],
    [5, '.OH......HO.'],
    [6, '.OH......HO.'],
    [7, '.OH......HO.'],
    [8, '.OHO....OHO.'],
  ],
  bun: [
    [0, '....OOOO....'],
    [1, '...OHHHHO...'],
    [2, '..OHHHHHHO..'],
    [3, '..OHHHHHHO..'],
    [4, '...H....H...'],
  ],
};

const HAT_LAYERS = {
  none: [],
  cap: [
    [1, '...OOOOOO...'],
    [2, '..OCCCCCCO..'],
    [3, '..OCCCCCCCCO'],
    [4, '..OOOOOOOOO.'],
  ],
  beanie: [
    [0, '....OWWO....'],
    [1, '...OOOOOO...'],
    [2, '..OCCCCCCO..'],
    [3, '.OCCCCCCCCO.'],
    [4, '.OWWWWWWWWO.'],
  ],
  crown: [
    [0, '..O..OO..O..'],
    [1, '..OYOYYOYO..'],
    [2, '..OYYYYYYO..'],
    [3, '..OOOOOOOO..'],
  ],
};

const GLASSES_LAYERS = {
  none: [],
  glasses: [[5, '..OOEOOEOO..']],
};

function applyLayer(rows, layer) {
  for (const [y, line] of layer) {
    const row = rows[y].split('');
    for (let x = 0; x < line.length; x++) if (line[x] !== '.') row[x] = line[x];
    rows[y] = row.join('');
  }
}

/** Build the sprite rows and colour key for an avatar config. */
export function buildAvatarSprite(config) {
  const a = sanitizeAvatar(config);
  const rows = [...BODY];
  applyLayer(rows, HAIR_LAYERS[a.hair]);
  applyLayer(rows, GLASSES_LAYERS[a.glasses]);
  applyLayer(rows, HAT_LAYERS[a.hat]);
  const colors = {
    O: PALETTE.ink,
    S: pick('skin', a.skin).color,
    E: PALETTE.ink,
    M: '#8a3b3b',
    H: pick('hairColor', a.hairColor).color,
    T: pick('shirt', a.shirt).color,
    P: '#3a3f5c',
    B: PALETTE.ink,
    C: pick('hatColor', a.hatColor).color,
    W: PALETTE.white,
    Y: PALETTE.gold,
  };
  return { rows, colors };
}
