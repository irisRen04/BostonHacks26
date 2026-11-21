import { useEffect, useMemo, useState } from 'react';
import { G, Path } from 'react-native-svg';

import { TROLLEY_SPRITE, squaresToPath, stampSprite } from '../theme/pixel';

const SPRITE_PX = 4;

/** The rider's Green Line trolley, bobbing over the current stop on a two-frame loop. */
export default function PlayerTrolley({ x, y }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => 1 - f), 380);
    return () => clearInterval(id);
  }, []);

  const parts = useMemo(() => {
    const buckets = {};
    stampSprite(buckets, TROLLEY_SPRITE, Math.round(x), Math.round(y), SPRITE_PX);
    return Object.entries(buckets).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
  }, [x, y]);

  return (
    <G transform={`translate(0 ${frame * -SPRITE_PX})`}>
      {parts.map(({ color, d }) => (
        <Path key={color} d={d} fill={color} />
      ))}
    </G>
  );
}
