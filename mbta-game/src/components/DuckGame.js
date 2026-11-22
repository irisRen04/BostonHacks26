import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FONT_BODY, FONT_TITLE, PALETTE, squaresToPath, stampSprite } from '../theme/pixel';

const N = 15; // board is N x N cells
const CELL = 20;
const SIZE = N * CELL;
const TICK_MS = 150;
const TOTAL_DUCKLINGS = 10;
const MOTHER = { x: N - 2, y: 1 };

// Duck facing right. H = head, Y = body, O = beak, K = eye.
const DUCK = [
  '...HHH....',
  '..HHHHH...',
  '..HKHHOO..',
  '..HHHHOO..',
  '...HHH....',
  '.YYYYYYY..',
  'YYYYYYYYY.',
  'YYYYYYYYY.',
  '.YYYYYYY..',
  '..........',
];
const BABY_COLORS = { H: PALETTE.gold, Y: '#ffe680', O: PALETTE.orange, K: PALETTE.ink };
const MOTHER_COLORS = { H: '#2f8f4e', Y: '#9b6b3f', O: PALETTE.gold, K: PALETTE.ink };
// Fallback player head, used when no renderHead prop is passed.
const HEAD = [
  '..KKKKKK..',
  '.KWWWWWWK.',
  'KWWKWWKWWK',
  'KWWWWWWWWK',
  'KWWWKKWWWK',
  'KWWWWWWWWK',
  '.KWWWWWWK.',
  '..KKKKKK..',
  '..........',
  '..........',
];
const HEAD_COLORS = { K: PALETTE.ink, W: '#f2c9a0' };

const same = (a, b) => a && b && a.x === b.x && a.y === b.y;

function spawnDuckling(snake) {
  const free = [];
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const c = { x, y };
      if (!same(c, MOTHER) && !snake.some((s) => same(s, c))) free.push(c);
    }
  return free[Math.floor(Math.random() * free.length)];
}

function freshGame() {
  const snake = [{ x: 7, y: 7 }];
  return { snake, dir: { x: 1, y: 0 }, queue: [], duck: spawnDuckling(snake), collected: 0 };
}

export default function DuckGame({ level = 1, avatar, renderHead, onWin, onClose }) {
  const reward = 40 * 2 ** (level - 1);
  const game = useRef(freshGame());
  const phaseRef = useRef('intro');
  const [phase, setPhaseState] = useState('intro'); // intro | ready | playing | won | lost
  const [, setFrame] = useState(0);

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const steer = useCallback((dx, dy) => {
    const g = game.current;
    if (phaseRef.current === 'ready') setPhase('playing');
    if (phaseRef.current !== 'playing') return;
    if (g.queue.length < 2) g.queue.push({ x: dx, y: dy });
  }, []);

  const start = () => {
    game.current = freshGame();
    setPhase('ready');
    setFrame((f) => f + 1);
  };

  // game loop
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const id = setInterval(() => {
      const g = game.current;
      while (g.queue.length) {
        const d = g.queue.shift();
        if (!(d.x === -g.dir.x && d.y === -g.dir.y)) {
          g.dir = d;
          break;
        }
      }
      const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N) {
        setPhase('lost');
        return;
      }
      const ate = same(head, g.duck);
      const body = ate ? g.snake : g.snake.slice(0, -1);
      if (body.some((s) => same(s, head))) {
        setPhase('lost');
        return;
      }
      g.snake = [head, ...g.snake];
      if (!ate) g.snake.pop();
      else {
        g.collected += 1;
        g.duck = g.collected < TOTAL_DUCKLINGS ? spawnDuckling(g.snake) : null;
      }
      if (g.collected === TOTAL_DUCKLINGS && same(head, MOTHER)) {
        setPhase('won');
        onWin?.(reward);
      }
      setFrame((f) => f + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, reward, onWin]);

  // keyboard (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const keys = {
      ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
    };
    const onKey = (e) => {
      const k = keys[e.key];
      if (!k) return;
      e.preventDefault();
      steer(k[0], k[1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steer]);

  // ---- board drawing ----
  const g = game.current;
  const light = [];
  const dark = [];
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) ((x + y) % 2 ? dark : light).push([x * CELL, y * CELL, CELL]);
  const babies = {};
  const mother = {};
  const headBucket = {};
  const spriteAt = (buckets, sprite, cell, colors) =>
    stampSprite(buckets, sprite, cell.x * CELL + CELL / 2, cell.y * CELL + CELL / 2, 2, colors);
  g.snake.slice(1).forEach((c) => spriteAt(babies, DUCK, c, BABY_COLORS));
  if (g.duck) spriteAt(babies, DUCK, g.duck, BABY_COLORS);
  spriteAt(mother, DUCK, MOTHER, MOTHER_COLORS);
  if (!renderHead) spriteAt(headBucket, HEAD, g.snake[0], HEAD_COLORS);
  const buckets = [babies, mother, headBucket];

  const hint =
    g.collected >= TOTAL_DUCKLINGS
      ? 'ALL FOUND! GO TO MAMA!'
      : phase === 'ready'
        ? 'PRESS A DIRECTION TO GO'
        : `Ducklings: ${g.collected}/${TOTAL_DUCKLINGS}`;

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        {phase === 'intro' ? (
          <>
            <Text style={styles.title}>CHALLENGE!</Text>
            <View style={{ marginVertical: 14 }}>
              <Svg width={80} height={80}>
                {Object.entries(
                  (() => {
                    const b = {};
                    stampSprite(b, DUCK, 40, 40, 7, MOTHER_COLORS);
                    return b;
                  })(),
                ).map(([color, sq]) => (
                  <Path key={color} d={squaresToPath(sq)} fill={color} />
                ))}
              </Svg>
            </View>
            <Text style={styles.body}>Mother Duck lost her 10 ducklings!</Text>
            <Text style={styles.body}>Collect them all, then bring them home.</Text>
            <Text style={styles.reward}>REWARD: {reward} XP</Text>
            <View style={styles.row}>
              <Btn label="ACCEPT" onPress={start} gold />
              <Btn label="RUN" onPress={onClose} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.hud}>{hint}</Text>
            <View style={{ width: SIZE, height: SIZE, borderWidth: 3, borderColor: PALETTE.parkEdge, boxSizing: 'content-box' }}>
              <Svg width={SIZE} height={SIZE}>
                <Path d={squaresToPath(light)} fill={PALETTE.park} />
                <Path d={squaresToPath(dark)} fill="#9fbb68" />
                {buckets.flatMap((b, i) =>
                  Object.entries(b).map(([color, sq]) => (
                    <Path key={`${i}${color}`} d={squaresToPath(sq)} fill={color} />
                  )),
                )}
              </Svg>
              {renderHead && (
                <View pointerEvents="none" style={{ position: 'absolute', left: g.snake[0].x * CELL, top: g.snake[0].y * CELL, width: CELL, height: CELL }}>
                  {renderHead(CELL)}
                </View>
              )}
              {(phase === 'won' || phase === 'lost') && (
                <View style={styles.result}>
                  <Text style={[styles.title, { color: phase === 'won' ? PALETTE.gold : PALETTE.red }]}>
                    {phase === 'won' ? 'REUNITED!' : 'OH NO!'}
                  </Text>
                  <Text style={styles.body}>
                    {phase === 'won' ? `+${reward} XP` : 'You crashed. Try again!'}
                  </Text>
                  <View style={styles.row}>
                    {phase === 'lost' && <Btn label="RETRY" onPress={start} gold />}
                    <Btn label={phase === 'won' ? 'DONE' : 'QUIT'} onPress={onClose} gold={phase === 'won'} />
                  </View>
                </View>
              )}
            </View>
            <View style={styles.dpad}>
              <Btn label="▲" onPress={() => steer(0, -1)} small />
              <View style={styles.row}>
                <Btn label="◀" onPress={() => steer(-1, 0)} small />
                <Btn label="▼" onPress={() => steer(0, 1)} small />
                <Btn label="▶" onPress={() => steer(1, 0)} small />
              </View>
            </View>
            {phase !== 'won' && phase !== 'lost' && <Btn label="QUIT" onPress={onClose} small />}
          </>
        )}
      </View>
    </View>
  );
}

function Btn({ label, onPress, gold, small }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && { width: 48, height: 40, paddingHorizontal: 0 },
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
  title: { fontFamily: FONT_TITLE, fontSize: 14, color: PALETTE.gold },
  body: { fontFamily: FONT_BODY, fontSize: 20, color: '#b7c0d8', textAlign: 'center' },
  reward: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.greenLight, marginVertical: 6 },
  hud: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dpad: { alignItems: 'center', gap: 6 },
  btn: {
    paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: PALETTE.ink, boxShadow: `3px 3px 0px ${PALETTE.ink}`,
  },
  btnText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.ink },
  result: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(27,27,47,0.88)', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
});