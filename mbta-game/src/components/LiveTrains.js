import { useEffect, useMemo, useState } from 'react';
import { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { POLL_MS } from '../live/mbta';
import { FONT_TITLE, PALETTE, TRAIN_COLORS, TRAIN_HEADLIGHT, TRAIN_SPRITE, squaresToPath, stampSprite } from '../theme/pixel';

const FRAME_MS = 100; // how often trains are moved along between position updates
const GLIDE_MS = POLL_MS * 0.9; // reach the new position just before the next update

/** Train sprite drawn around (0, 0), so each train only needs a translate (and a mirror). */
function useTrainParts(px) {
  return useMemo(() => {
    const buckets = {};
    stampSprite(buckets, TRAIN_SPRITE, 0, 0, px, TRAIN_COLORS);
    return Object.entries(buckets).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
  }, [px]);
}

/** Which way a train faces: the way it's moving, or else its compass bearing (0 = north, 90 = east). */
function facesRight(t) {
  const dx = t.to.x - t.from.x;
  if (Math.abs(dx) > 1) return dx > 0;
  return Math.sin(((t.bearing ?? 90) * Math.PI) / 180) >= 0;
}

// a stable 0..2π offset per train so headlights don't all pulse in sync
const phaseOf = (id) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 628 / 100;

/**
 * Live trains on the map, with an HD-2D-style finish: detailed pixel sprites, a
 * soft shadow under each car and a glowing headlight. Positions are State Plane
 * meters; (OX, OY, scale) is the map's world->screen transform. Each train glides
 * from its previous reported position to its latest one. Writes tap targets into hitsRef.
 */
export default function LiveTrains({ trains, scale, OX, OY, width, height, selectedId, showTags, hitsRef }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!trains.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), FRAME_MS);
    return () => clearInterval(id);
  }, [trains.length]);

  const px = scale < 0.05 ? 1 : scale < 0.3 ? 2 : 3; // small when zoomed out so they don't bury the stops
  const parts = useTrainParts(px);
  const w = TRAIN_SPRITE[0].length * px;
  const h = TRAIN_SPRITE.length * px;
  // headlight centre relative to the sprite centre (facing right)
  const lightX = (TRAIN_HEADLIGHT.col + 0.5) * px - w / 2;
  const lightY = (TRAIN_HEADLIGHT.row + 0.5) * px - h / 2;

  const placed = [];
  for (const t of trains) {
    const f = Math.min(1, Math.max(0, (now - t.receivedAt) / GLIDE_MS));
    const x = t.from.x + (t.to.x - t.from.x) * f;
    const y = t.from.y + (t.to.y - t.from.y) * f;
    const sx = Math.round(x * scale + OX);
    const sy = Math.round(-y * scale + OY);
    if (sx < -w || sy < -h || sx > width + w || sy > height + h) continue;
    placed.push({ t, sx, sy, right: facesRight(t) });
  }
  hitsRef.current = placed.map(({ t, sx, sy }) => ({ id: t.id, x0: sx - w / 2 - 4, x1: sx + w / 2 + 4, y0: sy - h / 2 - 4, y1: sy + h / 2 + 4 }));

  return (
    <G>
      <Defs>
        <RadialGradient id="trainShadow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#000" stopOpacity={0.45} />
          <Stop offset="100%" stopColor="#000" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="trainGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#fffbe0" stopOpacity={0.95} />
          <Stop offset="45%" stopColor="#ffd23f" stopOpacity={0.45} />
          <Stop offset="100%" stopColor="#ffd23f" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* soft shadows first, so no car's shadow falls on another car */}
      {placed.map(({ t, sx, sy }) => (
        <Ellipse key={`s-${t.id}`} cx={sx} cy={sy + h / 2} rx={w * 0.58} ry={Math.max(3, px * 3)} fill="url(#trainShadow)" />
      ))}

      {placed.map(({ t, sx, sy, right }) => {
        const pulse = 0.85 + 0.15 * Math.sin(now / 280 + phaseOf(t.id));
        return (
          <G key={t.id} transform={`translate(${sx} ${sy})`}>
            {t.id === selectedId && (
              <Rect x={-w / 2 - 4} y={-h / 2 - 4} width={w + 8} height={h + 8} fill="none" stroke={PALETTE.gold} strokeWidth={3} />
            )}
            <G transform={right ? undefined : 'scale(-1 1)'}>
              {parts.map(({ color, d }) => (
                <Path key={color} d={d} fill={color} />
              ))}
            </G>
            {/* headlight bloom, a little ahead of the car */}
            <Circle cx={right ? lightX + px : -lightX - px} cy={lightY} r={px * 6 * pulse} fill="url(#trainGlow)" />
            {showTags && (
              <G>
                <Rect x={-6} y={-h / 2 - 14} width={12} height={12} fill={PALETTE.ink} />
                <SvgText x={0.5} y={-h / 2 - 4} fontSize={8} fontFamily={FONT_TITLE} fill={PALETTE.gold} textAnchor="middle">
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
