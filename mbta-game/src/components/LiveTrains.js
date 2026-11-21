import { memo, useEffect, useMemo, useState } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { POLL_MS } from '../live/mbta';
import { FONT_TITLE, PALETTE, TRAIN_COLORS, TRAIN_SPRITE, squaresToPath, stampSprite } from '../theme/pixel';

const FRAME_MS = 100; // trains glide at 10 fps: they only move a few points a second
const PULSE_FRAME_MS = 50; // 20 fps while your train is pulsing, so the pulse stays smooth
const GLIDE_MS = POLL_MS * 0.9; // reach the new position just before the next update
const PULSE_MS = 1600; // one full grow-and-shrink
const PULSE_SIZE = 0.12; // how much your train grows at the top of the pulse
const YOURS_SIZE = 1.3; // your train is drawn a bit bigger than the rest

/** Train sprite drawn around (0, 0) pointing right, so each train only needs translate + rotate. */
function useTrainParts(px) {
  return useMemo(() => {
    const buckets = {};
    stampSprite(buckets, TRAIN_SPRITE, 0, 0, px, TRAIN_COLORS);
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
 * (OX, OY, scale) is the map's world->screen transform. Writes tap targets into hitsRef.
 */
function LiveTrains({ trains, scale, OX, OY, width, height, selectedId, waitingFor, hitsRef }) {
  const [now, setNow] = useState(Date.now());
  const pulsing = !!waitingFor && trains.some((t) => t.id === waitingFor.trainId);
  useEffect(() => {
    if (!trains.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), pulsing ? PULSE_FRAME_MS : FRAME_MS);
    return () => clearInterval(id);
  }, [trains.length, pulsing]);

  const px = scale < 0.15 ? 1 : scale < 0.4 ? 2 : 3; // small until zoomed in, so trains don't crowd the line
  const parts = useTrainParts(px);
  const w = TRAIN_SPRITE[0].length * px;
  const h = TRAIN_SPRITE.length * px;
  const beamLength = w * 1.4;

  const placed = [];
  for (const t of trains) {
    const f = Math.min(1, Math.max(0, (now - t.receivedAt) / GLIDE_MS));
    const x = t.from.x + (t.to.x - t.from.x) * f;
    const y = t.from.y + (t.to.y - t.from.y) * f;
    const sx = Math.round(x * scale + OX);
    const sy = Math.round(-y * scale + OY);
    if (sx < -w * 2 || sy < -w * 2 || sx > width + w * 2 || sy > height + w * 2) continue;
    const mine = t.id === waitingFor?.trainId;
    placed.push({ t, sx, sy, angle: headingOf(t), mine, beat: mine ? pulse(now) : 0 });
  }
  placed.sort((a, b) => a.mine - b.mine); // your train draws on top
  // rotated trains: a square around the centre is a forgiving tap target
  const reach = w / 2 + 4;
  hitsRef.current = placed.map(({ t, sx, sy }) => ({ id: t.id, x0: sx - reach, x1: sx + reach, y0: sy - reach, y1: sy + reach }));

  // Zoomed out, trains are only a few pixels long: draw them all as one combined shape
  // (small capsules along each heading) instead of ~16 shapes per train. Your train and an
  // opened train stay detailed.
  const simple = px === 1;
  let simplePath = '';
  if (simple) {
    for (const { t, sx, sy, angle, mine } of placed) {
      if (mine || t.id === selectedId) continue;
      const a = (angle * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const hl = w / 2; // half length
      const hw = h / 2; // half width
      const c = (l, s2) => `${(sx + ux * l - uy * s2).toFixed(1)} ${(sy + uy * l + ux * s2).toFixed(1)}`;
      simplePath += `M${c(-hl, -hw)}L${c(hl, -hw)}L${c(hl, hw)}L${c(-hl, hw)}Z`;
    }
  }
  const detailed = simple ? placed.filter(({ t, mine }) => mine || t.id === selectedId) : placed;

  return (
    <G>
      {simplePath ? <Path d={simplePath} fill={TRAIN_COLORS.G} stroke={TRAIN_COLORS.K} strokeWidth={1} /> : null}
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

      {/* soft shadows first, offset down a touch as if lit from above (skipped zoomed out: just haze) */}
      {px > 1 && placed.map(({ t, sx, sy, angle }) => (
        <G key={`s-${t.id}`} transform={`translate(${sx} ${sy + px * 2}) rotate(${angle})`}>
          <Ellipse cx={0} cy={0} rx={w * 0.6} ry={h * 0.9} fill="url(#trainShadow)" />
        </G>
      ))}

      {detailed.map(({ t, sx, sy, angle, beat, mine }) => {
        const size = mine ? YOURS_SIZE + PULSE_SIZE * beat : 1;
        const label = mine ? `YOUR TRAIN · ${waitingFor.minutes <= 0 ? 'NOW' : `${waitingFor.minutes} MIN`}` : null;
        const labelW = label ? label.length * 6 + 8 : 0;
        // the headlight beam: a cone from the front of the car (yours brightens as it grows)
        const beam = `M${w / 2 - px} ${-h * 0.3}L${w / 2 + beamLength} ${-h * 1.3}L${w / 2 + beamLength} ${h * 1.3}L${w / 2 - px} ${h * 0.3}Z`;
        return (
          <G key={t.id} transform={`translate(${sx} ${sy})`}>
            <G transform={`rotate(${angle}) scale(${size})`}>
              {(px > 1 || mine) && <Path d={beam} fill="url(#trainBeam)" opacity={mine ? 0.6 + 0.4 * beat : 0.45} />}
              {(mine || t.id === selectedId) && (
                <Rect x={-w / 2 - 4} y={-h / 2 - 4} width={w + 8} height={h + 8} fill="none" stroke={PALETTE.gold} strokeWidth={3} />
              )}
              {parts.map(({ color, d }) => (
                <Path key={color} d={d} fill={color} />
              ))}
            </G>
            {mine && (
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
