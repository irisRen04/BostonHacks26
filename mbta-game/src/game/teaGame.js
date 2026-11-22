// Tea-catching mini game: pure rules, no React. All coordinates are in "field pixels"
// (a fixed 320x420 arena that the UI draws 1:1).

export const FIELD_W = 320;
export const FIELD_H = 420;
export const GROUND_Y = 372; // the floor the player stands on
export const DURATION = 90; // seconds: 1:30
export const MAX_MISSES = 8; // this many drops hitting the floor and you drown
export const WATER_STEP = 14; // px the water rises per missed drop

// Sprite sizes (px) - must match src/game/sprites.js * the scales used in TeapotGame
export const PLAYER_W = 48;
export const PLAYER_H = 64;
export const PLAYER_TOP = GROUND_Y - PLAYER_H;
export const TEAPOT_W = 42;
export const TEAPOT_H = 27;
export const TEAPOT_TOP = PLAYER_TOP + 6 - TEAPOT_H; // teapot sits in the raised hands
export const MOUTH_Y = TEAPOT_TOP + 4; // centre of the teapot's open top
export const CATCH_HALF = 18; // horizontal reach of the mouth (a little generous)
export const MOUTH_PAD_UP = 8;
export const MOUTH_PAD_DOWN = 12;

// The thrower's hand (top-left of the field)
export const THROW_X = 62;
export const THROW_Y = 50;

const TEAPOT_MIN_X = TEAPOT_W / 2 + 4;
const TEAPOT_MAX_X = FIELD_W - TEAPOT_W / 2 - 4;

/** XP for winning: 40 * 2^(level - 1). Level 1 = 40, level 2 = 80, level 3 = 160 ... */
export const xpReward = (level) => 40 * 2 ** (Math.max(1, Math.floor(level) || 1) - 1);

export function createGame(rng = Math.random) {
  return {
    rng,
    t: 0,
    status: 'playing', // 'playing' | 'drowning' | 'won' | 'lost'
    drops: [],
    effects: [], // { id, kind: 'splash' | 'catch', x, y, age }
    nextId: 1,
    nextSpawn: 0.9,
    thrown: 0,
    caught: 0,
    misses: 0,
    waterH: 0,
    waterTarget: 0,
    drownT: 0,
    throwPose: 0, // seconds left showing the "throwing" pose
    teapotX: FIELD_W * 0.6,
    dragStartX: FIELD_W * 0.6,
  };
}

export function setTeapotX(game, x) {
  game.teapotX = Math.min(TEAPOT_MAX_X, Math.max(TEAPOT_MIN_X, x));
}

/** Touch input: remember where the teapot was when the finger went down... */
export function beginDrag(game) {
  game.dragStartX = game.teapotX;
}

/** ...then move it by how far the finger has travelled since. */
export function dragBy(game, dx) {
  setTeapotX(game, game.dragStartX + dx);
}

/** 0 -> 1 across the round; drives difficulty. */
const progressOf = (game) => Math.min(1, game.t / DURATION);

function spawn(game) {
  const { rng } = game;
  const p = progressOf(game);
  const gravity = 520 + 170 * p;
  // random arch: pick an apex height and a landing spot, then solve the launch velocity
  const rise = 50 + rng() * 100;
  const targetX = 90 + rng() * (FIELD_W - 90 - 16);
  const vy = -Math.sqrt(2 * gravity * rise);
  const fall = GROUND_Y - THROW_Y;
  const flight = (-vy + Math.sqrt(vy * vy + 2 * gravity * fall)) / gravity;
  const vx = (targetX - THROW_X) / flight;
  game.drops.push({
    id: game.nextId++,
    x: THROW_X,
    y: THROW_Y,
    vx,
    vy,
    g: gravity,
    tint: Math.floor(rng() * 3),
  });
  game.thrown += 1;
  game.throwPose = 0.28;

  // next throw: quicker as the round goes on, with a little jitter and the odd quick follow-up
  const base = 1.45 - 0.9 * p;
  game.nextSpawn = base * (0.8 + rng() * 0.4);
  if (p > 0.4 && rng() < 0.22) game.nextSpawn = 0.32;
}

function addEffect(game, kind, x, y) {
  game.effects.push({ id: game.nextId++, kind, x, y, age: 0 });
}

/** Advance the game by dt seconds. Mutates and returns `game`. */
export function stepGame(game, dt) {
  if (game.status === 'won' || game.status === 'lost') return game;

  game.t += dt;
  game.throwPose = Math.max(0, game.throwPose - dt);

  // water level eases towards its target (and rushes in once you're drowning)
  const rate = game.status === 'drowning' ? 170 : 40;
  if (game.waterH < game.waterTarget) {
    game.waterH = Math.min(game.waterTarget, game.waterH + rate * dt);
  }

  for (const e of game.effects) e.age += dt;
  game.effects = game.effects.filter((e) => e.age < 0.5);

  if (game.status === 'playing') {
    // stop throwing a couple of seconds before the bell so every drop gets resolved
    game.nextSpawn -= dt;
    if (game.nextSpawn <= 0 && game.t < DURATION - 2.5) spawn(game);

    const surfaceY = GROUND_Y - game.waterH;
    const alive = [];
    for (const d of game.drops) {
      d.vy += d.g * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      const inMouth =
        d.vy > 0 &&
        d.y >= MOUTH_Y - MOUTH_PAD_UP &&
        d.y <= MOUTH_Y + MOUTH_PAD_DOWN &&
        Math.abs(d.x - game.teapotX) <= CATCH_HALF;
      if (inMouth && d.y < surfaceY) {
        game.caught += 1;
        addEffect(game, 'catch', d.x, MOUTH_Y);
        continue;
      }
      if (d.y >= surfaceY) {
        game.misses += 1;
        addEffect(game, 'splash', d.x, surfaceY);
        if (game.misses >= MAX_MISSES) {
          game.status = 'drowning';
          game.waterTarget = FIELD_H + 10; // fill the whole screen
        } else {
          game.waterTarget = game.misses * WATER_STEP;
        }
        continue;
      }
      alive.push(d);
    }
    game.drops = alive;

    if (game.status === 'playing' && game.t >= DURATION) {
      game.status = 'won';
      game.drops = [];
    }
  }

  if (game.status === 'drowning') {
    game.drownT += dt;
    game.drops = [];
    if (game.waterH >= FIELD_H || game.drownT > 2.4) game.status = 'lost';
  }
  return game;
}

/**
 * A frozen copy of everything the UI draws. The simulation is mutated in place every frame,
 * so React renders from snapshots (never from the live object).
 */
export function snapshot(game) {
  return {
    t: game.t,
    status: game.status,
    caught: game.caught,
    thrown: game.thrown,
    misses: game.misses,
    waterH: game.waterH,
    teapotX: game.teapotX,
    throwPose: game.throwPose,
    drops: game.drops.map((d) => ({ id: d.id, x: d.x, y: d.y, tint: d.tint })),
    effects: game.effects.map((e) => ({ ...e })),
  };
}

/** Seconds left on the clock (never negative). */
export const timeLeft = (game) => Math.max(0, DURATION - game.t);

export function formatClock(seconds) {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
