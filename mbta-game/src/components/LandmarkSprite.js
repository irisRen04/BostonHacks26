import { useEffect, useMemo, useState } from 'react';
import Svg, { G, Path } from 'react-native-svg';

import { silhouetteOf } from '../data/landmarks';
import { squaresToPath, stampSprite } from '../theme/pixel';

const STEP_MS = 70; // default time between light-up steps
const HOLD_MS = 1500; // stay fully lit
const OFF_MS = 550; // dark pause before starting over

/**
 * For landmarks with `lightUp` (like the Citgo sign): how many light-up steps are
 * on right now. Each sprite pixel belongs to a step via lightUp.stepOf(x, y);
 * steps switch on in order, the sign holds fully lit, goes dark, and repeats.
 * Returns null (fully lit) when not animating.
 */
export function useLightUp(landmark, enabled) {
  const steps = landmark.lightUp?.steps ?? 0;
  const stepMs = landmark.lightUp?.stepMs ?? STEP_MS;
  const [tick, setTick] = useState(0);
  const active = enabled && steps > 0;
  const hold = Math.round(HOLD_MS / stepMs);
  const off = Math.round(OFF_MS / stepMs);
  useEffect(() => {
    if (!active) return undefined;
    const cycle = steps + hold + off;
    const id = setInterval(() => setTick((t) => (t + 1) % cycle), stepMs);
    return () => clearInterval(id);
  }, [active, steps, stepMs, hold, off]);
  if (!active) return null;
  if (tick < steps) return tick + 1;
  if (tick < steps + hold) return steps;
  return 0;
}

/** Sprite rows + colours with pixels whose step isn't on yet swapped to the "lights off" colours. */
function withLights(landmark, litSteps) {
  const { lightUp } = landmark;
  if (!lightUp || litSteps == null) return { rows: landmark.sprite, colors: landmark.colors };
  const rows = landmark.sprite.map((row, y) =>
    [...row]
      .map((c, x) => {
        const step = lightUp.stepOf(x, y);
        return step >= litSteps && lightUp.unlit[c] ? c.toLowerCase() : c;
      })
      .join(''),
  );
  const colors = { ...landmark.colors };
  for (const k of Object.keys(lightUp.unlit)) colors[k.toLowerCase()] = lightUp.unlit[k];
  return { rows, colors };
}

/** Landmark sprite paths with its bottom-centre at (x, y). Undiscovered landmarks are dark silhouettes. */
export function LandmarkPaths({ landmark, x, y, px, discovered, litSteps = null }) {
  const parts = useMemo(() => {
    const { rows, colors } = discovered ? withLights(landmark, litSteps) : { rows: landmark.sprite, colors: silhouetteOf(landmark.colors) };
    const buckets = {};
    const h = rows.length * px;
    stampSprite(buckets, rows, Math.round(x), Math.round(y - h / 2), px, colors);
    return Object.entries(buckets).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
  }, [landmark, x, y, px, discovered, litSteps]);
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
  const litSteps = useLightUp(props.landmark, props.discovered);
  return <LandmarkPaths {...props} litSteps={litSteps} />;
}

/** Standalone landmark picture for the UI. */
export default function LandmarkSprite({ landmark, px = 3, discovered = true, animated = false }) {
  const litSteps = useLightUp(landmark, animated && discovered);
  const width = landmark.sprite[0].length * px;
  const height = landmark.sprite.length * px;
  return (
    <Svg width={width} height={height} shapeRendering="crispEdges">
      <LandmarkPaths landmark={landmark} x={width / 2} y={height} px={px} discovered={discovered} litSteps={litSteps} />
    </Svg>
  );
}
