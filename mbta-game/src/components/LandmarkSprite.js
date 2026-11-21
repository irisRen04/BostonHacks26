import { useMemo } from 'react';
import Svg, { G, Path } from 'react-native-svg';

import { silhouetteOf } from '../data/landmarks';
import { squaresToPath, stampSprite } from '../theme/pixel';

/** Landmark sprite paths with its bottom-centre at (x, y). Undiscovered landmarks are dark silhouettes. */
export function LandmarkPaths({ landmark, x, y, px, discovered }) {
  const parts = useMemo(() => {
    const rows = landmark.sprite;
    const buckets = {};
    const h = rows.length * px;
    stampSprite(buckets, rows, Math.round(x), Math.round(y - h / 2), px, discovered ? landmark.colors : silhouetteOf(landmark.colors));
    return Object.entries(buckets).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
  }, [landmark, x, y, px, discovered]);
  return (
    <G>
      {parts.map(({ color, d }) => (
        <Path key={color} d={d} fill={color} />
      ))}
    </G>
  );
}

/** Standalone landmark picture for the UI. */
export default function LandmarkSprite({ landmark, px = 3, discovered = true }) {
  const width = landmark.sprite[0].length * px;
  const height = landmark.sprite.length * px;
  return (
    <Svg width={width} height={height} shapeRendering="crispEdges">
      <LandmarkPaths landmark={landmark} x={width / 2} y={height} px={px} discovered={discovered} />
    </Svg>
  );
}
