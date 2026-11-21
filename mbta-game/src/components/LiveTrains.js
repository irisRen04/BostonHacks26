import { useEffect, useMemo, useState } from 'react';
import { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { POLL_MS } from '../live/mbta';
import { FONT_TITLE, PALETTE, TROLLEY_SPRITE, squaresToPath, stampSprite } from '../theme/pixel';

const FRAME_MS = 100; // how often trains are moved along between position updates
const GLIDE_MS = POLL_MS * 0.9; // reach the new position just before the next update

/** Trolley sprite drawn around (0, 0), so each train only needs a translate. */
function useTrolleyParts(px) {
  return useMemo(() => {
    const buckets = {};
    stampSprite(buckets, TROLLEY_SPRITE, 0, 0, px);
    return Object.entries(buckets).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
  }, [px]);
}

/**
 * Live trains on the map. Positions are State Plane meters; (OX, OY, scale) is the
 * map's world->screen transform. Each train glides from its previous reported
 * position to its latest one. Writes tap targets into hitsRef.
 */
export default function LiveTrains({ trains, scale, OX, OY, width, height, selectedId, showTags, hitsRef }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!trains.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), FRAME_MS);
    return () => clearInterval(id);
  }, [trains.length]);

  const px = scale < 0.05 ? 1 : scale < 0.15 ? 2 : 3; // tiny when zoomed out so they don't bury the stops
  const parts = useTrolleyParts(px);
  const w = TROLLEY_SPRITE[0].length * px;
  const h = TROLLEY_SPRITE.length * px;

  const placed = [];
  for (const t of trains) {
    const f = Math.min(1, Math.max(0, (now - t.receivedAt) / GLIDE_MS));
    const x = t.from.x + (t.to.x - t.from.x) * f;
    const y = t.from.y + (t.to.y - t.from.y) * f;
    const sx = Math.round(x * scale + OX);
    const sy = Math.round(-y * scale + OY);
    if (sx < -w || sy < -h || sx > width + w || sy > height + h) continue;
    placed.push({ t, sx, sy });
  }
  hitsRef.current = placed.map(({ t, sx, sy }) => ({ id: t.id, x0: sx - w / 2 - 4, x1: sx + w / 2 + 4, y0: sy - h / 2 - 4, y1: sy + h / 2 + 4 }));

  return (
    <G>
      {placed.map(({ t, sx, sy }) => (
        <G key={t.id} transform={`translate(${sx} ${sy})`}>
          {t.id === selectedId && (
            <Rect x={-w / 2 - 4} y={-h / 2 - 4} width={w + 8} height={h + 8} fill="none" stroke={PALETTE.gold} strokeWidth={3} />
          )}
          {parts.map(({ color, d }) => (
            <Path key={color} d={d} fill={color} />
          ))}
          {showTags && (
            <G>
              <Rect x={-6} y={-h / 2 - 14} width={12} height={12} fill={PALETTE.ink} />
              <SvgText x={0.5} y={-h / 2 - 4} fontSize={8} fontFamily={FONT_TITLE} fill={PALETTE.gold} textAnchor="middle">
                {t.branch}
              </SvgText>
            </G>
          )}
        </G>
      ))}
    </G>
  );
}
