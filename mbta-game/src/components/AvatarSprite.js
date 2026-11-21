import { useMemo } from 'react';
import Svg, { G, Path } from 'react-native-svg';

import { buildAvatarSprite } from '../avatar/avatar';
import { squaresToPath, stampSprite } from '../theme/pixel';

/** Per-colour SVG paths for an avatar centred at (x, y) with pixel size `px`. */
export function useAvatarPaths(avatar, x, y, px) {
  return useMemo(() => {
    const { rows, colors } = buildAvatarSprite(avatar);
    const buckets = {};
    stampSprite(buckets, rows, Math.round(x), Math.round(y), px, colors);
    return Object.entries(buckets).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
  }, [avatar, x, y, px]);
}

export function AvatarPaths({ avatar, x, y, px, transform }) {
  const parts = useAvatarPaths(avatar, x, y, px);
  return (
    <G transform={transform}>
      {parts.map(({ color, d }) => (
        <Path key={color} d={d} fill={color} />
      ))}
    </G>
  );
}

/** Standalone avatar picture for the UI (buttons, customize preview). Sprite is 12x16 pixels. */
export default function AvatarSprite({ avatar, px = 4 }) {
  const width = 12 * px;
  const height = 16 * px;
  return (
    <Svg width={width} height={height} shapeRendering="crispEdges">
      <AvatarPaths avatar={avatar} x={width / 2} y={height / 2} px={px} />
    </Svg>
  );
}
