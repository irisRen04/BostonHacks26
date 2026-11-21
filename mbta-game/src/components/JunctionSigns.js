// Pixel signposts around a junction stop: one per way out, showing the branch
// letters that run that way (or BACK for the stop you came from).
import { G, Rect, Text as SvgText } from 'react-native-svg';

import { FONT_TITLE, PALETTE } from '../theme/pixel';

const SIGN_DISTANCE = 80; // px from the junction to each sign's center
const MIN_GAP = (55 * Math.PI) / 180; // smallest angle allowed between two signs
const HEAD_ANGLE = -Math.PI / 2; // the avatar's head floats straight above the stop
const TILE = 16;
const BOARD_H = 26;
const HIT_PAD = 8;

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Spread angles so no two are closer than MIN_GAP, keeping their order around
 * the circle. Fixed entries (the avatar's head) never move.
 */
function spreadAngles(items) {
  for (let pass = 0; pass < 40; pass++) {
    items.sort((a, b) => a.angle - b.angle);
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      const b = items[(i + 1) % items.length];
      const gap = i === items.length - 1 ? b.angle + 2 * Math.PI - a.angle : b.angle - a.angle;
      if (gap >= MIN_GAP - 1e-3) continue;
      const push = MIN_GAP - gap;
      if (a.fixed) b.angle = norm(b.angle + push);
      else if (b.fixed) a.angle = norm(a.angle - push);
      else {
        a.angle = norm(a.angle - push / 2);
        b.angle = norm(b.angle + push / 2);
      }
      moved = true;
    }
    if (!moved) break;
  }
  return items;
}

/**
 * Work out where each sign goes.
 *   signs:  [{ id, kind: 'branch' | 'back', branches: ['B', ...] }]
 *   center: junction position on screen; positions: id -> neighbour position on screen
 * Returns signs with { x, y, w, h, angle, hit: {x0, y0, x1, y1} }.
 */
export function layoutSigns(signs, center, positions) {
  const items = signs.map((s) => {
    const p = positions[s.id];
    return { sign: s, angle: Math.atan2(p.y - center.y, p.x - center.x), fixed: false };
  });
  items.push({ angle: HEAD_ANGLE, fixed: true });
  return spreadAngles(items)
    .filter((it) => !it.fixed)
    .map(({ sign, angle }) => {
      const w = sign.kind === 'back' ? 4 * 8 + 12 : sign.branches.length * (TILE + 2) + 8;
      const x = Math.round(center.x + Math.cos(angle) * SIGN_DISTANCE);
      const y = Math.round(center.y + Math.sin(angle) * SIGN_DISTANCE);
      return {
        ...sign,
        x,
        y,
        w,
        h: BOARD_H,
        angle,
        hit: { x0: x - w / 2 - HIT_PAD, y0: y - BOARD_H / 2 - HIT_PAD, x1: x + w / 2 + HIT_PAD, y1: y + BOARD_H / 2 + HIT_PAD },
      };
    });
}

export const SIGN_CLEAR_RADIUS = SIGN_DISTANCE + 40; // nameplates inside this are hidden

export function hitSign(placed, x, y) {
  return placed.find(({ hit }) => x >= hit.x0 && x <= hit.x1 && y >= hit.y0 && y <= hit.y1) ?? null;
}

function Trail({ center, angle, from, to }) {
  const dots = [];
  for (let r = from; r <= to; r += 9) {
    const x = Math.round(center.x + Math.cos(angle) * r);
    const y = Math.round(center.y + Math.sin(angle) * r);
    dots.push(
      <G key={r}>
        <Rect x={x - 3} y={y - 3} width={6} height={6} fill={PALETTE.ink} />
        <Rect x={x - 1} y={y - 1} width={2} height={2} fill={PALETTE.white} />
      </G>,
    );
  }
  return <G>{dots}</G>;
}

function Sign({ sign, active }) {
  const { x, y, w, h } = sign;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - h / 2);
  const back = sign.kind === 'back';
  return (
    <G>
      <Rect x={left + 3} y={top + 3} width={w} height={h} fill={PALETTE.ink} opacity={0.4} />
      <Rect x={left} y={top} width={w} height={h} fill={PALETTE.ink} />
      <Rect x={left + 2} y={top + 2} width={w - 4} height={h - 4} fill={active ? PALETTE.gold : back ? '#c9cfe0' : PALETTE.white} />
      {back ? (
        <SvgText x={x} y={y + 4} fontSize={8} fontFamily={FONT_TITLE} fill={PALETTE.ink} textAnchor="middle">
          BACK
        </SvgText>
      ) : (
        sign.branches.map((b, i) => {
          const tx = left + 4 + i * (TILE + 2);
          const ty = top + (h - TILE) / 2;
          return (
            <G key={b}>
              <Rect x={tx} y={ty} width={TILE} height={TILE} fill={PALETTE.green} />
              <SvgText x={tx + TILE / 2 + 0.5} y={ty + TILE / 2 + 4.5} fontSize={9} fontFamily={FONT_TITLE} fill={PALETTE.white} textAnchor="middle">
                {b}
              </SvgText>
            </G>
          );
        })
      )}
    </G>
  );
}

/** Signs, the dotted trails leading to them, and a gold frame on the stop the active sign leads to. */
export default function JunctionSigns({ placed, center, spriteHalf, activeId, target }) {
  return (
    <G>
      {target && (
        <Rect
          x={Math.round(target.x - spriteHalf - 5)}
          y={Math.round(target.y - spriteHalf - 5)}
          width={Math.round(spriteHalf * 2 + 10)}
          height={Math.round(spriteHalf * 2 + 10)}
          fill="none"
          stroke={PALETTE.gold}
          strokeWidth={4}
        />
      )}
      {placed.map((s) => (
        <Trail key={`t-${s.id}`} center={center} angle={s.angle} from={spriteHalf + 8} to={SIGN_DISTANCE - 20} />
      ))}
      {placed.map((s) => (
        <Sign key={s.id} sign={s} active={s.id === activeId} />
      ))}
    </G>
  );
}
