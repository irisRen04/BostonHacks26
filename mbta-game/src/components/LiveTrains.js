import { memo, useEffect, useMemo, useState } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { POLL_MS } from '../live/mbta';
import { FONT_TITLE, PALETTE, TRAIN_COLORS, TRAIN_SPRITE, squaresToPath, stampSprite } from '../theme/pixel';

const FRAME_MS = 100; // trains glide at 10 fps: they only move a few points a second
const PULSE_FRAME_MS = 50; // 20 fps while your train is pulsing, so the pulse stays smooth
const GLIDE_MS = POLL_MS * 0.9; // reach the new position just before the next update
const PULSE_MS = 1600; // one full grow-and-shrink
const PULSE_SIZE = 0.1; // how much your train grows at the top of the pulse
const YOURS_SIZE = 1.2; // your train is drawn a bit bigger than the rest (still well inside a stop target)

/**
 * The train palette with every green swapped for a dark gray of the same lightness, so the
 * body, its highlights and the simple capsule all share one dark-gray look. Outline, windows
 * and lights keep their colours. (Anything that isn't a "#rrggbb" string is left as is.)
 */
function grayGreens(colors) {
  const out = {};
  for (const [key, value] of Object.entries(colors)) {
    const m = /^#([0-9a-f]{6})$/i.exec(value);
    if (!m) {
      out[key] = value;
      continue;
    }
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    if (g > r + 15 && g > b + 15) {
      const gray = Math.round(45 + (0.3 * r + 0.59 * g + 0.11 * b) * 0.25); // dark: 45 to ~110
      const hex = gray.toString(16).padStart(2, '0');
      out[key] = `#${hex}${hex}${hex}`;
    } else {
      out[key] = value;
    }
  }
  return out;
}
const TRAINS = grayGreens(TRAIN_COLORS);

// ---- how big trains are, relative to the zoom and to the stop target they sit on
const FADE_ZERO = 0.03; // map scale (px per meter) at or below which trains are gone entirely
const FADE_FULL = 0.16; // map scale at or above which trains are at their full (capped) size
const STOP_RATIO = 0.5; // zoomed out: a train's length is at most this fraction of the stop target's width
const ZOOMED_IN_RATIO = 0.85; // zoomed right in it may grow to this fraction, so it's an easier tap target
const GROW_FROM = 0.25; // map scale where trains start growing from STOP_RATIO...
const GROW_TO = 0.6; // ...to ZOOMED_IN_RATIO
const MIN_TRAIN_LEN = 3; // a train shorter than this many points is just a smudge: don't draw it
const DETAIL_PX = 1; // below this many points per sprite pixel, trains are drawn as simple capsules

const smooth = (t) => t * t * (3 - 2 * t);
const unit = (v) => Math.min(1, Math.max(0, v));

/**
 * Train size multiplier for a map scale: 0 (no trains at all) when zoomed right out, easing
 * up to 1 (the STOP_RATIO size) by FADE_FULL, then on up to ZOOMED_IN_RATIO / STOP_RATIO
 * (1.3) as you zoom right in. Steps of 0.05, so the map only redraws trains ~25 times across
 * a whole zoom.
 */
export function trainFade(scale) {
  const appear = smooth(unit((scale - FADE_ZERO) / (FADE_FULL - FADE_ZERO)));
  const grow = smooth(unit((scale - GROW_FROM) / (GROW_TO - GROW_FROM)));
  return Math.round(appear * (1 + (ZOOMED_IN_RATIO / STOP_RATIO - 1) * grow) * 20) / 20;
}

/** Train sprite drawn around (0, 0) pointing right, so each train only needs translate + rotate. */
function useTrainParts(px) {
  return useMemo(() => {
    const buckets = {};
    stampSprite(buckets, TRAIN_SPRITE, 0, 0, px, TRAINS);
    return Object.entries(buckets).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
  }, [px]);
}

/**
 * Screen angle a train points at, in degrees clockwise from "right": the way it's
 * moving, or else its compass bearing (0 = north, 90 = east) when it's standing still.
 */
function headingOf(t) {
  const dx = t.to.x - t.from.x;
  const dy = t.to.y - t.from.y;
  if (Math.hypot(dx, dy) > 3) return (Math.atan2(-dy, dx) * 180) / Math.PI; // map y points north, screen y down
  return (t.bearing ?? 90) - 90;
}

/** A steady, even grow and shrink: 0 (normal size) up to 1 (biggest) and back. */
function pulse(ms) {
  return (1 - Math.cos((2 * Math.PI * (ms % PULSE_MS)) / PULSE_MS)) / 2;
}


/**
 * Live trains on the map, seen from above. Each train points along its heading with
 * a headlight beam shining ahead and sits on a soft shadow. The train you're waiting
 * for (waitingFor = { trainId, minutes }) is bigger, outlined in gold, tagged, and
 * gently grows and shrinks; every other train stays still. Positions are State Plane meters;
 * (OX, OY, scale) is the cached layer's world->screen transform. Writes tap targets into hitsRef.
 *
 * Size: `fade` (see trainFade, 0 to 1.3) is the zoom-driven size multiplier and `stopSize` is the
 * width of a stop icon in the same units as the layer. A train is never longer than
 * STOP_RATIO (growing to ZOOMED_IN_RATIO when zoomed right in) of that, so the ring of the
 * stop target stays visible and tappable around it. Below a few points a train isn't drawn
 * (or tappable) at all.
 */
function LiveTrains({ trains, scale, OX, OY, width, height, selectedId, waitingFor, hitsRef, fade = 1, stopSize = 24 }) {
  const [now, setNow] = useState(Date.now());
  const pulsing = !!waitingFor && trains.some((t) => t.id === waitingFor.trainId);

  const spriteW = TRAIN_SPRITE[0].length;
  const px = Math.round(((STOP_RATIO * stopSize) / spriteW) * fade * 4) / 4; // points per sprite pixel
  const w = spriteW * px;
  const h = TRAIN_SPRITE.length * px;
  const visible = trains.length > 0 && w >= MIN_TRAIN_LEN;

  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => setNow(Date.now()), pulsing ? PULSE_FRAME_MS : FRAME_MS);
    return () => clearInterval(id);
  }, [visible, pulsing]);

  const parts = useTrainParts(Math.max(px, 0.25));

  if (!visible) {
    hitsRef.current = []; // zoomed out: nothing drawn, so nothing to tap
    return null;
  }

  const beamLength = w * 1.4;
  const cull = Math.max(w, 24) * 2;

  const placed = [];
  for (const t of trains) {
    const f = Math.min(1, Math.max(0, (now - t.receivedAt) / GLIDE_MS));
    const x = t.from.x + (t.to.x - t.from.x) * f;
    const y = t.from.y + (t.to.y - t.from.y) * f;
    const sx = Math.round(x * scale + OX);
    const sy = Math.round(-y * scale + OY);
    if (sx < -cull || sy < -cull || sx > width + cull || sy > height + cull) continue;
    const mine = t.id === waitingFor?.trainId;
    placed.push({ t, sx, sy, angle: headingOf(t), mine, beat: mine ? pulse(now) : 0 });
  }
  placed.sort((a, b) => a.mine - b.mine); // your train draws on top
  // rotated trains: a square around the centre is a forgiving tap target (but never bigger than the train)
  const reach = Math.max(5, w / 2 + 1);
  hitsRef.current = placed.map(({ t, sx, sy, mine }) => {
    const r = mine ? reach * YOURS_SIZE : reach; // your train is drawn bigger, so its tap box is too
    return { id: t.id, x0: sx - r, x1: sx + r, y0: sy - r, y1: sy + r };
  });

  // Small trains are drawn all as one combined shape (a capsule along each heading) instead
  // of ~16 shapes per train. Your train and an opened train stay detailed.
  const simple = px < DETAIL_PX;
  let simplePath = '';
  if (simple) {
    for (const { t, sx, sy, angle, mine } of placed) {
      if (mine || t.id === selectedId) continue;
      const a = (angle * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const hl = w / 2;
      const hw = Math.max(1, h / 2);
      const c = (l, s2) => `${(sx + ux * l - uy * s2).toFixed(1)} ${(sy + uy * l + ux * s2).toFixed(1)}`;
      simplePath += `M${c(-hl, -hw)}L${c(hl, -hw)}L${c(hl, hw)}L${c(-hl, hw)}Z`;
    }
  }
  const detailed = simple ? placed.filter(({ t, mine }) => mine || t.id === selectedId) : placed;
  const pad = px * 1.33 + 1; // gold outline gap, scaled with the train
  const outline = Math.max(1, px);

  return (
    <G>
      {simplePath ? <Path d={simplePath} fill={TRAINS.G} stroke={TRAINS.K} strokeWidth={1} /> : null}
      <Defs>
        <RadialGradient id="trainShadow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#000" stopOpacity={0.4} />
          <Stop offset="100%" stopColor="#000" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="trainBeam" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#fff6c4" stopOpacity={0.85} />
          <Stop offset="60%" stopColor="#ffd23f" stopOpacity={0.25} />
          <Stop offset="100%" stopColor="#ffd23f" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* soft shadows first, offset down a touch as if lit from above (skipped for small trains: just haze) */}
      {px >= DETAIL_PX && placed.map(({ t, sx, sy, angle }) => (
        <G key={`s-${t.id}`} transform={`translate(${sx} ${sy + px * 2}) rotate(${angle})`}>
          <Ellipse cx={0} cy={0} rx={w * 0.6} ry={h * 0.9} fill="url(#trainShadow)" />
        </G>
      ))}

      {detailed.map(({ t, sx, sy, angle, beat, mine }) => {
        const size = mine ? YOURS_SIZE + PULSE_SIZE * beat : 1;
        // the tag is only readable when the train is big enough to be worth tagging
        const label = mine && px >= DETAIL_PX ? `YOUR TRAIN · ${waitingFor.minutes <= 0 ? 'NOW' : `${waitingFor.minutes} MIN`}` : null;
        const labelW = label ? label.length * 6 + 8 : 0;
        // the headlight beam: a cone from the front of the car (yours brightens as it grows)
        const beam = `M${w / 2 - px} ${-h * 0.3}L${w / 2 + beamLength} ${-h * 1.3}L${w / 2 + beamLength} ${h * 1.3}L${w / 2 - px} ${h * 0.3}Z`;
        return (
          <G key={t.id} transform={`translate(${sx} ${sy})`}>
            <G transform={`rotate(${angle}) scale(${size})`}>
              {(px >= 1.25 || mine) && <Path d={beam} fill="url(#trainBeam)" opacity={mine ? 0.6 + 0.4 * beat : 0.45} />}
              {(mine || t.id === selectedId) && (
                <Rect x={-w / 2 - pad} y={-h / 2 - pad} width={w + pad * 2} height={h + pad * 2} fill="none" stroke={PALETTE.gold} strokeWidth={outline} />
              )}
              {parts.map(({ color, d }) => (
                <Path key={color} d={d} fill={color} />
              ))}
            </G>
            {label && (
              <G>
                <Rect x={-labelW / 2} y={-reach * YOURS_SIZE - 16} width={labelW} height={13} fill={PALETTE.gold} />
                <SvgText x={0} y={-reach * YOURS_SIZE - 6} fontSize={6} fontFamily={FONT_TITLE} fill={PALETTE.ink} textAnchor="middle">
                  {label}
                </SvgText>
              </G>
            )}
          </G>
        );
      })}
    </G>
  );
}

// Re-renders only for its own animation or when trains change, not on every pan frame.
export default memo(LiveTrains);
