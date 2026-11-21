import { memo } from 'react';
import { Circle, G } from 'react-native-svg';

import { LINE_COLORS } from '../data/greenLine';

/**
 * Bullseye/target icon for a stop: white outer disc, green ring, white ring, green center.
 * Transfer stations get a black outer ring (as on the MBTA map); the selected stop gets a halo.
 */
function StationTarget({ x, y, radius, transfer, selected }) {
  const r = selected ? radius * 1.35 : radius;
  const green = LINE_COLORS.Green;
  return (
    <G>
      {selected && <Circle cx={x} cy={y} r={r * 1.7} fill="#FFC72C" opacity={0.55} />}
      <Circle cx={x} cy={y} r={r} fill="#fff" stroke={transfer ? '#1c1c1c' : green} strokeWidth={Math.max(1.5, r * 0.22)} />
      <Circle cx={x} cy={y} r={r * 0.62} fill={green} />
      <Circle cx={x} cy={y} r={r * 0.4} fill="#fff" />
      <Circle cx={x} cy={y} r={r * 0.2} fill={green} />
    </G>
  );
}

export default memo(StationTarget);
