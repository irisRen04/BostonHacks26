import { useEffect, useMemo, useState } from 'react';
import Svg, { G, Path } from 'react-native-svg';

import { silhouetteOf } from '../data/landmarks';
import { squaresToPath, stampSprite } from '../theme/pixel';

const STEP_MS = 70; // one more row lights up every step
const HOLD_STEPS = 22; // stay fully lit
const OFF_STEPS = 8; // dark pause before starting over

/**
 * For landmarks with a `lightUp` range (like the Citgo sign): how many rows of
 * that range are lit right now. Lights come on top to bottom, hold, switch off,
 * and repeat. Returns null (fully lit) when not animating.
 */
export function useLightUp(landmark, enabled) {
  const rows = landmark.lightUp ? landmark.lightUp.to - landmark.lightUp.from : 0;
  const [step, setStep] = useState(0);
  const active = enabled && rows > 0;
  useEffect(() => {
    if (!active) return undefined;
    const cycle = rows + HOLD_STEPS + OFF_STEPS;
    const id = setInterval(() => setStep((s) => (s + 1) % cycle), STEP_MS);
    return () => clearInterval(id);
  }, [active, rows]);
  if (!active) return null;
  if (step < rows) return step + 1;
  if (step < rows + HOLD_STEPS) return rows;
  return 0;
}

/** Sprite rows + colours with the unlit part of the lightUp range swapped to the "lights off" colours. */
function withLights(landmark, litRows) {
  const { lightUp } = landmark;
  if (!lightUp || litRows == null) return { rows: landmark.sprite, colors: landmark.colors };
  const firstDark = lightUp.from + litRows;
  const unlitKeys = Object.keys(lightUp.unlit);
  const rows = landmark.sprite.map((row, y) =>
    y >= firstDark && y < lightUp.to ? row.replace(new RegExp(`[${unlitKeys.join('')}]`, 'g'), (c) => c.toLowerCase()) : row,
  );
  const colors = { ...landmark.colors };
  for (const k of unlitKeys) colors[k.toLowerCase()] = lightUp.unlit[k];
  return { rows, colors };
}

/** Landmark sprite paths with its bottom-centre at (x, y). Undiscovered landmarks are dark silhouettes. */
export function LandmarkPaths({ landmark, x, y, px, discovered, litRows = null }) {
  const parts = useMemo(() => {
    const { rows, colors } = discovered ? withLights(landmark, litRows) : { rows: landmark.sprite, colors: silhouetteOf(landmark.colors) };
    const buckets = {};
    const h = rows.length * px;
    stampSprite(buckets, rows, Math.round(x), Math.round(y - h / 2), px, colors);
    return Object.entries(buckets).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
  }, [landmark, x, y, px, discovered, litRows]);
  return (
    <G>
      {parts.map(({ color, d }) => (
        <Path key={color} d={d} fill={color} />
      ))}
    </G>
  );
}

/** Same as LandmarkPaths, but discovered landmarks with lights play their light-up loop. */
export function AnimatedLandmarkPaths(props) {
  const litRows = useLightUp(props.landmark, props.discovered);
  return <LandmarkPaths {...props} litRows={litRows} />;
}

/** Standalone landmark picture for the UI. */
export default function LandmarkSprite({ landmark, px = 3, discovered = true, animated = false }) {
  const litRows = useLightUp(landmark, animated && discovered);
  const width = landmark.sprite[0].length * px;
  const height = landmark.sprite.length * px;
  return (
    <Svg width={width} height={height} shapeRendering="crispEdges">
      <LandmarkPaths landmark={landmark} x={width / 2} y={height} px={px} discovered={discovered} litRows={litRows} />
    </Svg>
  );
}
