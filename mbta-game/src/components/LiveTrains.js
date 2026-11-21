import { useEffect, useMemo, useState } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { POLL_MS } from '../live/mbta';
import { FONT_TITLE, PALETTE, TRAIN_COLORS, TRAIN_SPRITE, squaresToPath, stampSprite } from '../theme/pixel';

const FRAME_MS = 50; // animation frame (20 fps): smooth enough for the pulse
const GLIDE_MS = POLL_MS * 0.9; // reach the new position just before the next update
const PULSE_MS = 1600; // one full grow-and-shrink
const PULSE_SIZE = 0.08; // how much a moving train grows at the top of the pulse

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

// a stable offset per train so moving trains don't all pulse in sync
const phaseOf = (id) => ([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 1000) * (PULSE_MS / 1000);

const isMoving = (t) => t.status !== 'STOPPED_AT' && Math.hypot(t.to.x - t.from.x, t.to.y - t.from.y) > 3;

/**
 * Live trains on the map, seen from above. Each train points along its heading with
 * a headlight beam shining ahead, sits on a soft shadow, and gently grows and shrinks
 * while it's moving (stopped trains stay still). Positions are State Plane meters;
 * (OX, OY, scale) is the map's world->screen transform. Writes tap targets into hitsRef.
 */
export default function LiveTrains({ trains, scale, OX, OY, width, height, selectedId, showTags, hitsRef }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!trains.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), FRAME_MS);
    return () => clearInterval(id);
  }, [trains.length]);

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
    const moving = isMoving(t);
    placed.push({ t, sx, sy, angle: headingOf(t), beat: moving ? pulse(now + phaseOf(t.id)) : 0, moving });
  }
  // rotated trains: a square around the centre is a forgiving tap target
  const reach = w / 2 + 4;
  hitsRef.current = placed.map(({ t, sx, sy }) => ({ id: t.id, x0: sx - reach, x1: sx + reach, y0: sy - reach, y1: sy + reach }));

  return (
    <G>
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

      {/* soft shadows first, offset down a touch as if lit from above */}
      {placed.map(({ t, sx, sy, angle }) => (
        <G key={`s-${t.id}`} transform={`translate(${sx} ${sy + px * 2}) rotate(${angle})`}>
          <Ellipse cx={0} cy={0} rx={w * 0.6} ry={h * 0.9} fill="url(#trainShadow)" />
        </G>
      ))}

      {placed.map(({ t, sx, sy, angle, beat, moving }) => {
        const size = 1 + PULSE_SIZE * beat;
        // the headlight beam: a cone from the front of the car, brightening as the train grows
        const beam = `M${w / 2 - px} ${-h * 0.3}L${w / 2 + beamLength} ${-h * 1.3}L${w / 2 + beamLength} ${h * 1.3}L${w / 2 - px} ${h * 0.3}Z`;
        return (
          <G key={t.id} transform={`translate(${sx} ${sy})`}>
            <G transform={`rotate(${angle}) scale(${size})`}>
              <Path d={beam} fill="url(#trainBeam)" opacity={moving ? 0.55 + 0.45 * beat : 0.4} />
              {t.id === selectedId && (
                <Rect x={-w / 2 - 4} y={-h / 2 - 4} width={w + 8} height={h + 8} fill="none" stroke={PALETTE.gold} strokeWidth={3} />
              )}
              {parts.map(({ color, d }) => (
                <Path key={color} d={d} fill={color} />
              ))}
            </G>
            {showTags && (
              <G>
                <Rect x={-6} y={-reach - 12} width={12} height={12} fill={PALETTE.ink} />
                <SvgText x={0.5} y={-reach - 2} fontSize={8} fontFamily={FONT_TITLE} fill={PALETTE.gold} textAnchor="middle">
                  {t.branch}
                </SvgText>
              </G>
            )}
          </G>
        );
      })}
    </G>
  );
}
