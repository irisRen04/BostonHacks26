import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { playMusic, playSfx } from '../audio/sounds';
import {
  DURATION,
  FIELD_H,
  FIELD_W,
  GROUND_Y,
  MAX_MISSES,
  PLAYER_H,
  PLAYER_TOP,
  PLAYER_W,
  TEAPOT_TOP,
  TEAPOT_W,
  beginDrag,
  createGame,
  dragBy,
  formatClock,
  setTeapotX,
  snapshot,
  stepGame,
  timeLeft,
  xpReward,
} from '../game/teaGame';
import {
  DROP,
  DROP_TINTS,
  PATRIOT_IDLE,
  PATRIOT_PALETTE,
  PATRIOT_THROW,
  PLAYER,
  PLAYER_PALETTE,
  TEAPOT,
  TEAPOT_PALETTE,
} from '../game/sprites';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';
import PixelArt from './PixelArt';

const PATRIOT_PX = 4;
const PATRIOT_LEFT = 8;
const PATRIOT_TOP = 24;
const DROP_PX = DROP.scale;
const DROP_W = DROP.rows[0].length * DROP_PX;
const DROP_H = DROP.rows.length * DROP_PX;
const DROP_PALETTES = DROP_TINTS.map((t) => ({ ...t }));

const WATER = 'rgba(53,129,214,0.55)';
const WAVE = 'rgba(191,230,255,0.9)';

/* --------------------------------------------------------------------------------------- */
/* Arena drawing (pure: draws whatever `game` currently holds)                              */
/* --------------------------------------------------------------------------------------- */

// Night harbour: sky bands, moon, stars, dock planks, and the thrower's ledge. Never changes.
const STARS = [
  [30, 18], [96, 40], [150, 14], [210, 52], [262, 24], [298, 70], [60, 96], [188, 100], [120, 150],
  [250, 130], [20, 170], [300, 190], [82, 230], [220, 210], [160, 260],
];

const Backdrop = memo(function Backdrop() {
  const planks = [];
  for (let x = 0; x < FIELD_W; x += 40) {
    planks.push(<View key={x} style={[styles.plankGap, { left: x }]} />);
  }
  return (
    <>
      <View style={[styles.sky, { top: 0, height: 140, backgroundColor: '#0e1636' }]} />
      <View style={[styles.sky, { top: 140, height: 120, backgroundColor: '#16224c' }]} />
      <View style={[styles.sky, { top: 260, height: GROUND_Y - 260, backgroundColor: '#20306a' }]} />
      {STARS.map(([x, y]) => (
        <View key={`${x}-${y}`} style={[styles.star, { left: x, top: y }]} />
      ))}
      <View style={styles.moon} />
      <View style={styles.moonShade} />
      {/* thrower's ledge */}
      <View style={styles.ledge} />
      <View style={styles.ledgePost} />
      {/* dock */}
      <View style={styles.dock} />
      {planks}
    </>
  );
});

function Effect({ e }) {
  const a = e.age / 0.5; // 0 -> 1
  if (e.kind === 'catch') {
    const rise = a * 22;
    return (
      <>
        {[-10, 0, 10].map((dx, i) => (
          <View
            key={dx}
            style={[
              styles.spark,
              { left: e.x + dx - 2, top: e.y - 6 - rise - (i === 1 ? 6 : 0), opacity: 1 - a },
            ]}
          />
        ))}
      </>
    );
  }
  // splash: four droplets flying out and falling back
  const spread = a * 26;
  const lift = Math.sin(a * Math.PI) * 18;
  return (
    <>
      {[
        [-1, 1],
        [-0.45, 1.5],
        [0.45, 1.5],
        [1, 1],
      ].map(([sx, sy]) => (
        <View
          key={`${sx}`}
          style={[
            styles.splash,
            { left: e.x + sx * spread - 2, top: e.y - lift * sy - 2, opacity: 1 - a * 0.8 },
          ]}
        />
      ))}
    </>
  );
}

/** Catches a crash inside a custom avatar and falls back to the built-in pixel player. */
class SafeSlot extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const DefaultPlayer = memo(function DefaultPlayer() {
  return <PixelArt rows={PLAYER} palette={PLAYER_PALETTE} px={4} />;
});

function ArenaView({ game, renderPlayer }) {
  const throwing = game.throwPose > 0;
  const surfaceY = GROUND_Y - game.waterH;
  const showWater = game.waterH > 0.5;
  const waveShift = Math.floor(game.t * 5);
  const drowning = game.status === 'drowning' || game.status === 'lost';
  const waves = [];
  if (showWater) {
    for (let i = 0; i < FIELD_W / 10; i += 1) {
      waves.push(
        <View
          key={i}
          style={[styles.wave, { left: i * 10, top: surfaceY - 4 + ((i + waveShift) % 2) * 3 }]}
        />,
      );
    }
  }

  return (
    <>
      <Backdrop />

      <PixelArt
        rows={throwing ? PATRIOT_THROW : PATRIOT_IDLE}
        palette={PATRIOT_PALETTE}
        px={PATRIOT_PX}
        style={{ position: 'absolute', left: PATRIOT_LEFT, top: PATRIOT_TOP }}
      />

      {game.drops.map((d) => (
        <PixelArt
          key={d.id}
          rows={DROP.rows}
          palette={DROP_PALETTES[d.tint]}
          px={DROP_PX}
          style={{ position: 'absolute', left: d.x - DROP_W / 2, top: d.y - DROP_H / 2 }}
        />
      ))}

      {/* the player, arms up under the teapot */}
      <View
        style={{
          position: 'absolute',
          left: game.teapotX - PLAYER_W / 2,
          top: PLAYER_TOP,
          width: PLAYER_W,
          height: PLAYER_H,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {renderPlayer ? (
          <SafeSlot fallback={<DefaultPlayer />}>{renderPlayer(PLAYER_H - 10)}</SafeSlot>
        ) : (
          <DefaultPlayer />
        )}
      </View>
      <PixelArt
        rows={TEAPOT}
        palette={TEAPOT_PALETTE}
        px={3}
        style={{ position: 'absolute', left: game.teapotX - TEAPOT_W / 2, top: TEAPOT_TOP }}
      />

      {game.effects.map((e) => (
        <Effect key={e.id} e={e} />
      ))}

      {showWater && (
        <>
          <View style={[styles.water, { top: surfaceY, height: FIELD_H - surfaceY }]} />
          {waves}
        </>
      )}

      {drowning && (
        <View style={styles.glubWrap} pointerEvents="none">
          <Text style={styles.glub}>GLUB GLUB...</Text>
        </View>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------------------- */
/* Arena: owns the game loop and the controls                                               */
/* --------------------------------------------------------------------------------------- */

function Arena({ renderPlayer, onEnd }) {
  // `sim` is mutated in place by the loop / input handlers (never read while rendering);
  // `game` is the immutable snapshot React actually draws.
  const [sim] = useState(createGame);
  const [game, setGame] = useState(() => snapshot(sim));
  const fieldRef = useRef(null);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  });

  // game loop
  useEffect(() => {
    let raf = 0;
    let timer = 0;
    let last = null;
    let finished = false;
    const frame = (ts) => {
      const dt = last === null ? 0 : Math.min(0.05, (ts - last) / 1000); // cap: a hiccup can't teleport drops
      last = ts;
      stepGame(sim, dt);
      setGame(snapshot(sim));
      if (sim.status === 'won' || sim.status === 'lost') {
        if (!finished) {
          finished = true;
          // linger a moment so the last splash / flood is seen
          timer = setTimeout(
            () => onEndRef.current({ won: sim.status === 'won', caught: sim.caught, thrown: sim.thrown }),
            sim.status === 'won' ? 600 : 900,
          );
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [sim]);

  // touch / drag: the teapot follows the finger's movement
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => beginDrag(sim),
        onPanResponderMove: (_, s) => dragBy(sim, s.dx),
      }),
    [sim],
  );

  // mouse (web): the teapot follows the pointer, no click needed
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const onMove = (e) => {
      const el = fieldRef.current;
      if (!el || !el.getBoundingClientRect) return;
      setTeapotX(sim, e.clientX - el.getBoundingClientRect().left);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [sim]);

  const thumbLeft = (game.teapotX / FIELD_W) * (FIELD_W - 30);
  const left = timeLeft(game);

  return (
    <View>
      {/* HUD */}
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudLabel}>TIME</Text>
          <Text style={[styles.hudValue, left <= 10 && { color: '#ff7a7a' }]}>{formatClock(left)}</Text>
        </View>
        <View style={styles.hudMid}>
          <Text style={styles.hudLabel}>CAUGHT</Text>
          <Text style={styles.hudValue}>{game.caught}</Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>FLOOD</Text>
          <View style={styles.gauge}>
            {Array.from({ length: MAX_MISSES }, (_, i) => (
              <View key={i} style={[styles.gaugeCell, i < game.misses && styles.gaugeCellOn]} />
            ))}
          </View>
        </View>
      </View>

      <View {...pan.panHandlers}>
        <View ref={fieldRef} style={styles.field} collapsable={false}>
          <ArenaView game={game} renderPlayer={renderPlayer} />
        </View>
        <View style={styles.strip}>
          <Text style={styles.stripText}>{'◀  DRAG HERE  ▶'}</Text>
          <View style={[styles.thumb, { left: thumbLeft }]} />
        </View>
      </View>
    </View>
  );
}

/* --------------------------------------------------------------------------------------- */
/* Popup shell: intro -> playing -> result                                                  */
/* --------------------------------------------------------------------------------------- */

function PixelButton({ label, onPress, primary }) {
  return (
    <Pressable
      onPress={(e) => {
        playSfx('click');
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.btn,
        primary && styles.btnPrimary,
        pressed ? styles.btnPressed : styles.btnUp,
      ]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Props
 *  level       the player's current level (reward = 40 * 2^(level-1) XP)
 *  renderPlayer (size) => element   optional: draw the player's custom avatar
 *  onWin(xp)   called once, the moment the player survives the full 1:30
 *  onClose()   close the popup
 */
export default function TeapotGame({ level = 1, renderPlayer, onWin, onClose }) {
  const [phase, setPhase] = useState('intro'); // intro | playing | won | lost
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const reward = xpReward(level);
  const lvl = Math.max(1, Math.floor(level) || 1);

  // minigame music while this popup is open, map music when it closes
  useEffect(() => {
    playMusic('moreMinigame');
    return () => playMusic('gameplay');
  }, []);

  const start = useCallback(() => {
    setRound((r) => r + 1);
    setPhase('playing');
  }, []);

  const handleEnd = useCallback(
    (r) => {
      setResult(r);
      setPhase(r.won ? 'won' : 'lost');
      if (r.won) onWin?.(reward);
    },
    [onWin, reward],
  );

  return (
    <View style={styles.backdrop}>
      <View style={styles.box}>
        {phase === 'intro' && (
          <View style={styles.center}>
            <Text style={styles.alert}>! YOU HAVE BEEN CHALLENGED !</Text>
            <View style={styles.introRow}>
              <PixelArt rows={PATRIOT_THROW} palette={PATRIOT_PALETTE} px={5} />
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>
                  HALT, TRAVELER! CATCH MY TEA OR SWIM IN THE HARBOR!
                </Text>
              </View>
            </View>
            <View style={styles.rules}>
              <Text style={styles.rule}>▸ CATCH EVERY DROP IN YOUR TEAPOT</Text>
              <Text style={styles.rule}>▸ SURVIVE {formatClock(DURATION)}</Text>
              <Text style={styles.rule}>▸ EACH DROP ON THE FLOOR FLOODS THE ROOM</Text>
              <Text style={styles.rule}>▸ {MAX_MISSES} MISSES AND YOU DROWN</Text>
              <Text style={styles.rule}>▸ DRAG YOUR FINGER OR MOVE THE MOUSE</Text>
            </View>
            <View style={styles.reward}>
              <Text style={styles.rewardLabel}>REWARD</Text>
              <Text style={styles.rewardValue}>+{reward} XP</Text>
              <Text style={styles.rewardSub}>
                LV {lvl}: 40 × 2^{lvl - 1}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <PixelButton label="ACCEPT" primary onPress={start} />
              <PixelButton label="RUN AWAY" onPress={onClose} />
            </View>
          </View>
        )}

        {phase === 'playing' && (
          <Arena key={round} renderPlayer={renderPlayer} onEnd={handleEnd} />
        )}

        {phase === 'won' && (
          <View style={styles.center}>
            <Text style={[styles.alert, { color: PALETTE.greenLight }]}>TEA TIME!</Text>
            <Text style={styles.resultLine}>YOU SURVIVED THE FLOOD</Text>
            <Text style={styles.resultSub}>
              CAUGHT {result?.caught} OF {result?.thrown} DROPS
            </Text>
            <View style={styles.reward}>
              <Text style={styles.rewardLabel}>YOU EARNED</Text>
              <Text style={styles.rewardValue}>+{reward} XP</Text>
            </View>
            <View style={styles.btnRow}>
              <PixelButton label="DONE" primary onPress={onClose} />
            </View>
          </View>
        )}

        {phase === 'lost' && (
          <View style={styles.center}>
            <Text style={[styles.alert, { color: '#ff7a7a' }]}>YOU DROWNED</Text>
            <Text style={styles.resultLine}>THE HARBOR CLAIMS ANOTHER</Text>
            <Text style={styles.resultSub}>
              CAUGHT {result?.caught} OF {result?.thrown} DROPS
            </Text>
            <View style={styles.btnRow}>
              <PixelButton label="TRY AGAIN" primary onPress={start} />
              <PixelButton label="LEAVE" onPress={onClose} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const BOX_W = FIELD_W + 24;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    elevation: 60,
    backgroundColor: 'rgba(8,10,24,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: BOX_W,
    backgroundColor: PALETTE.night,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    boxShadow: `4px 4px 0px ${PALETTE.ink}`,
    padding: 9,
  },
  center: { alignItems: 'center', paddingVertical: 6 },

  // ---- intro / result
  alert: { fontFamily: FONT_TITLE, fontSize: 11, color: PALETTE.gold, textAlign: 'center', lineHeight: 18 },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  bubble: {
    flex: 1,
    backgroundColor: PALETTE.white,
    borderWidth: 3,
    borderColor: PALETTE.ink,
    padding: 8,
  },
  bubbleText: { fontFamily: FONT_BODY, fontSize: 19, color: PALETTE.ink, lineHeight: 20 },
  rules: { alignSelf: 'stretch', marginTop: 14, gap: 2 },
  rule: { fontFamily: FONT_BODY, fontSize: 18, color: '#b7c0d8' },
  reward: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    backgroundColor: PALETTE.ink,
  },
  rewardLabel: { fontFamily: FONT_TITLE, fontSize: 7, color: '#b7c0d8' },
  rewardValue: { fontFamily: FONT_TITLE, fontSize: 16, color: PALETTE.gold, marginTop: 6 },
  rewardSub: { fontFamily: FONT_BODY, fontSize: 16, color: '#b7c0d8', marginTop: 4 },
  resultLine: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white, marginTop: 16, textAlign: 'center' },
  resultSub: { fontFamily: FONT_BODY, fontSize: 20, color: '#b7c0d8', marginTop: 8 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: {
    minWidth: 112,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: PALETTE.white,
    borderWidth: 3,
    borderColor: PALETTE.ink,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: PALETTE.gold },
  btnUp: { boxShadow: `3px 3px 0px ${PALETTE.ink}` },
  btnPressed: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  btnText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.ink },

  // ---- HUD
  hud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  hudMid: { alignItems: 'center' },
  hudRight: { alignItems: 'flex-end' },
  hudLabel: { fontFamily: FONT_TITLE, fontSize: 7, color: PALETTE.gold },
  hudValue: { fontFamily: FONT_TITLE, fontSize: 13, color: PALETTE.white, marginTop: 4 },
  gauge: { flexDirection: 'row', gap: 2, marginTop: 5 },
  gaugeCell: { width: 11, height: 12, backgroundColor: PALETTE.ink, borderWidth: 1, borderColor: PALETTE.panelEdge },
  gaugeCellOn: { backgroundColor: '#3d8fe8', borderColor: '#bfe6ff' },

  // ---- arena
  field: {
    width: FIELD_W,
    height: FIELD_H,
    overflow: 'hidden',
    backgroundColor: '#0e1636',
    borderWidth: 0,
  },
  sky: { position: 'absolute', left: 0, width: FIELD_W },
  star: { position: 'absolute', width: 3, height: 3, backgroundColor: '#dfe6ff' },
  moon: { position: 'absolute', left: 262, top: 34, width: 28, height: 28, backgroundColor: '#f6e7a8' },
  moonShade: { position: 'absolute', left: 272, top: 34, width: 18, height: 28, backgroundColor: '#e6d28a' },
  ledge: { position: 'absolute', left: 0, top: PATRIOT_TOP + 22 * PATRIOT_PX, width: 84, height: 12, backgroundColor: '#8a5a2b', borderTopWidth: 3, borderTopColor: '#b07a3f' },
  ledgePost: { position: 'absolute', left: 10, top: PATRIOT_TOP + 22 * PATRIOT_PX + 12, width: 10, height: GROUND_Y - (PATRIOT_TOP + 22 * PATRIOT_PX + 12), backgroundColor: '#5f3d1c' },
  dock: { position: 'absolute', left: 0, top: GROUND_Y, width: FIELD_W, height: FIELD_H - GROUND_Y, backgroundColor: '#6b4423', borderTopWidth: 4, borderTopColor: '#9a6a36' },
  plankGap: { position: 'absolute', top: GROUND_Y + 4, width: 3, height: FIELD_H - GROUND_Y, backgroundColor: '#4a2d14' },
  spark: { position: 'absolute', width: 4, height: 4, backgroundColor: PALETTE.gold },
  splash: { position: 'absolute', width: 4, height: 4, backgroundColor: '#bfe6ff' },
  water: { position: 'absolute', left: 0, width: FIELD_W, backgroundColor: WATER },
  wave: { position: 'absolute', width: 10, height: 4, backgroundColor: WAVE },
  glubWrap: { position: 'absolute', left: 0, right: 0, top: 150, alignItems: 'center' },
  glub: { fontFamily: FONT_TITLE, fontSize: 14, color: PALETTE.white },

  // ---- drag strip
  strip: {
    width: FIELD_W,
    height: 50,
    marginTop: 8,
    backgroundColor: PALETTE.ink,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stripText: { fontFamily: FONT_TITLE, fontSize: 8, color: '#b7c0d8' },
  thumb: { position: 'absolute', top: 0, width: 30, height: 44, backgroundColor: PALETTE.gold, opacity: 0.55 },
});
