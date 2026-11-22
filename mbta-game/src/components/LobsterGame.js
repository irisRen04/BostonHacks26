import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';

// ---- tuning ----
const W = 300; // board size in screen points
const H = 180;
const FLOOR = 140; // y of the steel counter top
const S = 3; // size of one sprite pixel
const TICK_MS = 33;
const DURATION = 30; // seconds
const GRAV = 0.65;
const JUMP_V = 9.5;
const LOB_X = 50; // lobster's fixed screen x
const LOB_H = 7 * S;
const WIN_STOP = 170; // where the ocean window stops scrolling
const DIVE_TICKS = 24;

// ---- night kitchen palette (built on the shared pixel palette) ----
const C = {
  wall: '#4a5060',
  seam: '#3a3f4e',
  frame: '#9aa3b5',
  frameDark: '#6b7393',
  sky0: '#0d1233',
  sky1: '#161c4a',
  sky2: '#232a63',
  moon: '#fff3b0',
  moonShade: '#e5d88a',
  city: '#080b22',
  steelTop: '#dfe5ee',
  steel: '#9aa3b8',
  steelDark: '#6b7393',
  panel: '#5b6377',
  rivet: '#3a3f4e',
};

// ---- sprites ('.' is transparent) ----
const LOBSTER_TOP = [
  '........RR.RR',
  '.......RRRRRR',
  'K....RRRRRRR.',
  '.K.RRRRRRWKR.',
  'DDRRRRRRRRRR.',
  'DDDRRRRRRRR..',
];
const LEGS_A = '.DD.R.R.R.R..';
const LEGS_B = '.DD..R.R.R.R.';
const lobster = (legs) => [...LOBSTER_TOP, legs];
const ALIVE = { R: PALETTE.red, D: '#8f2a26', K: PALETTE.ink, W: PALETTE.white };
const COOKED = { R: PALETTE.orange, D: '#b8601a', K: PALETTE.ink, W: PALETTE.white };

// Boiling pot on a burner, two frames so the bubbles, steam and flames animate.
const POT_A = [
  '...S...S...',
  '..S..S..S..',
  '.KKKKKKKKK.',
  'KwWwWwWwWwK',
  'HKMMMMMMMKH',
  '.KMMMMMMMK.',
  '.KMmMMMmMK.',
  '.KMMMMMMMK.',
  '..KKKKKKK..',
  '..F.O.F.O..',
];
const POT_B = [
  '..S...S....',
  '...S..S..S.',
  '.KKKKKKKKK.',
  'KWwWwWwWwWK',
  'HKMMMMMMMKH',
  '.KMMMMMMMK.',
  '.KMmMMMmMK.',
  '.KMMMMMMMK.',
  '..KKKKKKK..',
  '..O.F.O.F..',
];
const POT_H = POT_A.length * S;
const POT_COLORS = {
  S: '#cfd6e6',
  K: PALETTE.ink,
  w: PALETTE.waterLight,
  W: PALETTE.white,
  H: '#3a3f4e',
  M: PALETTE.silver,
  m: '#6b7393',
  F: PALETTE.gold,
  O: PALETTE.orange,
};

const CHEF = [
  '..WWWWWWW..',
  '.WWWWWWWWW.',
  '.WWWWWWWWW.',
  '..WWWWWWW..',
  '..SSSSSSS..',
  '..SKSSSKS..',
  '..SSSSSSS..',
  '..SMMMMMS..',
  '..SSSSSSS..',
  '.WWWWWWWWW.',
  'SWWWWKWWWWS',
  'SWWWWKWWWWS',
  '.WWWWWWWWW.',
  '.WWWWWWWWW.',
  '..GGG.GGG..',
  '..GGG.GGG..',
  '.KKKK.KKKK.',
];
const CHEF_COLORS = { W: PALETTE.white, S: '#f2c9a0', K: PALETTE.ink, M: '#5a3a22', G: PALETTE.silver };

// ---- tiny drawing helpers: buckets of rects keyed by colour ----
const rect = (o, c, x, y, w, h) => {
  (o[c] ??= []).push([x, y, w, h]);
};
function blit(o, sprite, x0, y0, s, colors) {
  for (let y = 0; y < sprite.length; y++) {
    const row = sprite[y];
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (c) rect(o, c, x0 + x * s, y0 + y * s, s, s);
    }
  }
}
const pathOf = (list) => list.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join('');
const renderLayers = (layers) =>
  layers.flatMap((o, i) =>
    Object.entries(o).map(([c, list]) => <Path key={`${i}-${c}`} d={pathOf(list)} fill={c} />),
  );

// Deterministic star field for the kitchen window.
const STARS = (() => {
  const a = [];
  let s = 7;
  for (let i = 0; i < 26; i++) {
    s = (s * 73 + 19) % 1009;
    const x = 28 + (s % 206);
    const y = 20 + (((s * 31 + 7) % 1009) % 34);
    if ((x > 100 && x < 112) || (x > 186 && x < 198) || (x > 232 && y < 46)) continue;
    a.push([x, y]);
  }
  return a;
})();

function drawSkyline(o, left, right, bottom) {
  for (let x = left, i = 0; x < right; x += 16, i++) {
    const h = 14 + ((i * 7) % 5) * 5;
    rect(o, C.city, x, bottom - h, 14, h);
    if (i % 2 === 0) rect(o, PALETTE.gold, x + 4, bottom - h + 4, 2, 2);
    if (i % 3 === 0) rect(o, PALETTE.gold, x + 9, bottom - h + 9, 2, 2);
  }
}

/** The whole play field for one frame, as ordered layers of coloured rects. */
function buildScene(g, phase) {
  const L = [];
  const layer = () => {
    const o = {};
    L.push(o);
    return o;
  };
  let o = layer();
  rect(o, C.wall, 0, 0, W, FLOOR);

  // brushed-metal wall panels, drifting slowly for parallax
  o = layer();
  const wOff = Math.floor((g.scroll * 0.25) % 50);
  for (let x = -wOff; x < W; x += 50) rect(o, C.seam, x, 0, 2, FLOOR);
  for (let y = 36; y < FLOOR; y += 36) rect(o, C.seam, 0, y, W, 2);

  // the big kitchen window onto a starry night
  o = layer();
  rect(o, C.frameDark, 18, 12, 264, 84);
  rect(o, C.sky0, 24, 18, 252, 72);
  rect(o, C.sky1, 24, 48, 252, 22);
  rect(o, C.sky2, 24, 70, 252, 20);
  rect(o, C.moon, 238, 26, 12, 16);
  rect(o, C.moon, 236, 28, 16, 12);
  rect(o, C.moonShade, 242, 31, 3, 3);
  rect(o, C.moonShade, 246, 35, 2, 2);
  o = layer();
  drawSkyline(o, 24, 276, 90);
  o = layer();
  const tw = Math.floor(g.t / 500);
  STARS.forEach(([x, y], i) => {
    if ((i + tw) % 4 !== 0) rect(o, PALETTE.white, x, y, 2, 2);
  });
  o = layer();
  rect(o, C.frame, 104, 18, 5, 72);
  rect(o, C.frame, 190, 18, 5, 72);
  rect(o, C.frame, 14, 92, 272, 6);

  // stainless counter you run along, with a riveted front panel scrolling past
  o = layer();
  rect(o, C.steelTop, 0, FLOOR, W, 3);
  rect(o, C.steel, 0, FLOOR + 3, W, 10);
  rect(o, C.steelDark, 0, FLOOR + 13, W, 3);
  rect(o, C.panel, 0, FLOOR + 16, W, H - FLOOR - 16);
  o = layer();
  const fOff = Math.floor(g.scroll % 60);
  for (let x = -fOff; x < W; x += 60) {
    rect(o, C.seam, x, FLOOR + 16, 2, H - FLOOR - 16);
    rect(o, C.rivet, x + 8, FLOOR + 22, 3, 3);
    rect(o, C.rivet, x + 8, FLOOR + 36, 3, 3);
  }

  // boiling pots
  o = layer();
  const potFrame = Math.floor(g.t / 200) % 2 ? POT_B : POT_A;
  g.pots.forEach((p) => blit(o, potFrame, Math.round(p.x), FLOOR - POT_H, S, POT_COLORS));

  // the ocean window at the end of the counter
  if (g.winX != null) {
    const wx = Math.round(g.winX);
    const wy = 60;
    o = layer();
    rect(o, C.frame, wx, wy, 64, FLOOR - wy);
    rect(o, C.sky0, wx + 5, wy + 5, 54, 52);
    rect(o, C.sky1, wx + 5, wy + 35, 54, 22);
    rect(o, C.moon, wx + 40, wy + 12, 8, 8);
    rect(o, PALETTE.waterDeep, wx + 5, wy + 57, 54, FLOOR - wy - 57);
    const ph = Math.floor(g.t / 300) % 2;
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 4; k++)
        rect(o, PALETTE.waterLight, wx + 7 + k * 13 + ((r + ph) % 2) * 6, wy + 60 + r * 7, 6, 2);
    rect(o, C.steelTop, wx - 4, FLOOR - 3, 72, 3);
  }

  // the lobster
  o = layer();
  if (phase !== 'won') {
    const dead = phase === 'lost';
    const onGround = g.y <= 0;
    const legs = !onGround || Math.floor(g.t / 130) % 2 ? LEGS_B : LEGS_A;
    const lx = Math.round(g.lx);
    const top = Math.round(FLOOR - LOB_H - g.y);
    if (dead) {
      rect(o, PALETTE.white, lx - 4, top + LOB_H, 47, 3); // plate
      rect(o, PALETTE.gold, lx + 40, top + LOB_H - 6, 6, 6); // lemon wedge
      rect(o, '#cfd6e6', lx + 10, top - 7, 2, 4);
      rect(o, '#cfd6e6', lx + 18, top - 11, 2, 4);
      rect(o, '#cfd6e6', lx + 26, top - 7, 2, 4);
    }
    blit(o, lobster(legs), lx, top, S, dead ? COOKED : ALIVE);
  } else {
    // splash where the lobster went in
    const sx = Math.round(g.winX) + 32;
    [[-6, 100], [4, 96], [-2, 90], [8, 104], [-10, 106], [0, 110]].forEach(([dx, y]) =>
      rect(o, PALETTE.white, sx + dx, y, 3, 3),
    );
    rect(o, PALETTE.waterLight, sx - 12, 118, 24, 3);
  }
  return L;
}

/** Intro art: the chef, a lobster leaping out of his grip, and a pot waiting below. */
function buildIntro() {
  const L = [];
  const layer = () => {
    const o = {};
    L.push(o);
    return o;
  };
  let o = layer();
  rect(o, C.wall, 0, 0, 260, 130);
  for (let x = 20; x < 260; x += 50) rect(o, C.seam, x, 0, 2, 108);
  o = layer();
  rect(o, C.frameDark, 50, 8, 160, 62);
  rect(o, C.sky0, 55, 13, 150, 52);
  rect(o, C.sky1, 55, 40, 150, 25);
  rect(o, C.moon, 176, 18, 12, 12);
  drawSkyline(o, 55, 205, 65);
  [[70, 20], [92, 30], [120, 18], [140, 34], [160, 22], [110, 40]].forEach(([x, y]) =>
    rect(o, PALETTE.white, x, y, 2, 2),
  );
  o = layer();
  rect(o, C.frame, 128, 13, 4, 52);
  rect(o, C.steelTop, 0, 108, 260, 3);
  rect(o, C.steel, 0, 111, 260, 14);
  rect(o, C.steelDark, 0, 125, 260, 5);
  o = layer();
  blit(o, CHEF, 24, 108 - CHEF.length * 4, 4, CHEF_COLORS);
  blit(o, lobster(LEGS_B), 96, 34, 4, ALIVE);
  [[84, 58, 8], [78, 66, 12], [86, 74, 6]].forEach(([x, y, w]) => rect(o, PALETTE.white, x, y, w, 3));
  blit(o, POT_A, 196, 108 - POT_A.length * 4, 4, POT_COLORS);
  return L;
}
const INTRO_LAYERS = buildIntro();

const freshGame = () => ({
  t: 0, // ms since the run began
  startAt: 0,
  scroll: 0,
  y: 0, // height above the counter
  vy: 0,
  lx: LOB_X,
  pots: [],
  since: 0, // distance since the last pot
  gap: 200,
  winX: null, // ocean window position once it appears
  diveT: 0,
  diveStartY: 0,
});

export default function LobsterGame({ level = 1, onWin, onClose }) {
  const reward = Math.floor((1/20) * Math.floor(level));
  const game = useRef(freshGame());
  const phaseRef = useRef('intro');
  const [phase, setPhaseState] = useState('intro'); // intro | ready | playing | dive | won | lost
  const [, setFrame] = useState(0);
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const jump = useCallback(() => {
    const g = game.current;
    if (phaseRef.current === 'ready') {
      g.startAt = Date.now();
      setPhase('playing');
    }
    if (phaseRef.current !== 'playing') return;
    if (g.y <= 0 && g.vy === 0) g.vy = JUMP_V;
  }, []);

  const start = () => {
    game.current = freshGame();
    setPhase('ready');
    setFrame((f) => f + 1);
  };

  // game loop
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'dive') return undefined;
    const id = setInterval(() => {
      const g = game.current;
      const ph = phaseRef.current;
      g.t = Date.now() - g.startAt;

      if (ph === 'playing') {
        const speed = 4.5 + 2 * Math.min(1, g.t / 40000); // gets faster as the clock runs
        g.scroll += speed;

        if (g.y > 0 || g.vy > 0) {
          g.y += g.vy;
          g.vy -= GRAV;
          if (g.y <= 0) {
            g.y = 0;
            g.vy = 0;
          }
        }

        if (g.winX == null) {
          g.since += speed;
          if (g.t < 41000 && g.since >= g.gap) {
            g.pots.push({ x: W + 10 });
            g.since = 0;
            g.gap = 230 + Math.random() * 130;
          }
        }
        g.pots.forEach((p) => {
          p.x -= speed;
        });
        g.pots = g.pots.filter((p) => p.x > -50);

        // boiled!
        const hit = g.pots.some((p) => p.x + 4 < LOB_X + 34 && p.x + 29 > LOB_X + 5 && g.y < POT_H - 9);
        if (hit) {
          g.y = 0;
          g.vy = 0;
          setPhase('lost');
          setFrame((f) => f + 1);
          return;
        }

        // time's up: the ocean window slides in
        if (g.t >= DURATION * 1000 && g.winX == null) g.winX = W + 10;
        if (g.winX != null) {
          g.winX -= speed;
          if (g.winX <= WIN_STOP) {
            g.winX = WIN_STOP;
            g.diveStartY = g.y;
            g.diveT = 0;
            setPhase('dive');
          }
        }
      } else if (ph === 'dive') {
        g.diveT += 1;
        const p = Math.min(1, g.diveT / DIVE_TICKS);
        g.lx = LOB_X + (g.winX + 32 - 19 - LOB_X) * p;
        g.y = g.diveStartY * (1 - p) + 55 * Math.sin(Math.PI * p);
        if (p >= 1) {
          setPhase('won');
          onWinRef.current?.(reward);
        }
      }
      setFrame((f) => f + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, reward]);

  // keyboard (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  const g = game.current;
  const secLeft = Math.max(0, Math.ceil(DURATION - g.t / 1000));
  const frac = Math.min(1, g.t / (DURATION * 1000));
  const hint =
    phase === 'ready'
      ? 'TAP THE BOARD TO START'
      : phase === 'dive' || phase === 'won'
        ? 'THE OCEAN!'
        : `TIME ${secLeft}`;

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        {phase === 'intro' ? (
          <>
            <Text style={styles.title}>CHALLENGE!</Text>
            <View style={styles.board}>
              <Svg width={260} height={130}>
                {renderLayers(INTRO_LAYERS)}
              </Svg>
            </View>
            <Text style={styles.body}>The chef wants you for dinner!</Text>
            <Text style={styles.body}>Hop the boiling pots for 45 seconds,</Text>
            <Text style={styles.body}>then leap out the window into the ocean.</Text>
            <Text style={styles.reward}>REWARD: {reward} XP</Text>
            <View style={styles.row}>
              <Btn label="ACCEPT" onPress={start} gold />
              <Btn label="RUN" onPress={onClose} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.hud}>{hint}</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: W * frac }]} />
            </View>
            <View style={styles.board}>
              <Pressable onPressIn={jump} style={{ width: W, height: H }}>
                <Svg width={W} height={H} pointerEvents="none">
                  {renderLayers(buildScene(g, phase))}
                </Svg>
              </Pressable>
            </View>

            {phase === 'won' || phase === 'lost' ? (
              <View style={styles.result}>
                <Text style={[styles.title, { color: phase === 'won' ? PALETTE.gold : PALETTE.red }]}>
                  {phase === 'won' ? 'SPLASH! FREE!' : 'BOILED!'}
                </Text>
                <Text style={styles.body}>{phase === 'won' ? `+${reward} XP` : 'You became dinner.'}</Text>
                <View style={styles.row}>
                  {phase === 'lost' && <Btn label="RETRY" onPress={start} gold />}
                  <Btn label={phase === 'won' ? 'DONE' : 'QUIT'} onPress={onClose} gold={phase === 'won'} />
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Btn label="JUMP" onPressIn={jump} gold wide />
                <Btn label="QUIT" onPress={onClose} />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function Btn({ label, onPress, onPressIn, gold, wide }) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [
        styles.btn,
        wide && { paddingHorizontal: 40 },
        { backgroundColor: gold ? PALETTE.gold : PALETTE.white },
        pressed && { transform: [{ translateX: 3 }, { translateY: 3 }] },
      ]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(20,20,31,0.85)', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  panel: {
    backgroundColor: PALETTE.night, borderWidth: 3, borderColor: PALETTE.panelEdge,
    boxShadow: `4px 4px 0px ${PALETTE.ink}`, padding: 12, alignItems: 'center', gap: 8, maxWidth: '96%',
  },
  board: { borderWidth: 3, borderColor: PALETTE.panelEdge },
  bar: { width: W + 6, height: 6, backgroundColor: PALETTE.ink },
  barFill: { height: 6, backgroundColor: PALETTE.orange },
  title: { fontFamily: FONT_TITLE, fontSize: 14, color: PALETTE.gold },
  body: { fontFamily: FONT_BODY, fontSize: 20, color: '#b7c0d8', textAlign: 'center' },
  reward: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.greenLight, marginVertical: 4 },
  hud: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  result: { alignItems: 'center', gap: 6 },
  btn: {
    paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: PALETTE.ink, boxShadow: `3px 3px 0px ${PALETTE.ink}`,
  },
  btnText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.ink },
});