import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Polyline, Text as SvgText } from 'react-native-svg';

import { LINE_COLORS, greenBounds, stations, tracks } from '../data/greenLine';
import StationTarget from './StationTarget';

const TAP_SLOP = 8; // px a finger may move and still count as a tap
const HIT_RADIUS = 26; // px around a stop that counts as touching it
const MAX_SCALE = 1.6; // px per meter at full zoom-in
const LABEL_SCALE = 0.09; // zoom level at which every stop gets a name label
const LABEL_FONT = Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif-medium', default: 'Helvetica Neue, Helvetica, Arial, sans-serif' });

function fitCamera(width, height) {
  const pad = 0.88;
  const w = greenBounds.maxX - greenBounds.minX;
  const h = greenBounds.maxY - greenBounds.minY;
  return {
    scale: Math.min((width * pad) / w, (height * pad) / h),
    cx: (greenBounds.minX + greenBounds.maxX) / 2,
    cy: (greenBounds.minY + greenBounds.maxY) / 2,
  };
}

const distance = (a, b) => Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
const midpoint = (a, b) => ({ x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 });

/**
 * Pan/zoomable MBTA map. Real track geometry from the ArcGIS shapefile is drawn
 * as the background; Green Line stops are drawn on top as target icons.
 * Map coordinates are State Plane meters (y = north), projected to screen as
 *   sx = (x - cx) * scale + width / 2,  sy = (cy - y) * scale + height / 2.
 */
const TransitMap = forwardRef(function TransitMap({ selectedId, onSelectStation }, ref) {
  const [size, setSize] = useState(null);
  const [camera, setCamera] = useState(null);
  const cameraRef = useRef(camera);
  const sizeRef = useRef(size);
  const minScaleRef = useRef(0);
  const containerRef = useRef(null);
  const onSelectRef = useRef(onSelectStation);
  cameraRef.current = camera;
  sizeRef.current = size;
  onSelectRef.current = onSelectStation;

  const applyCamera = useCallback((next) => {
    const scale = Math.min(MAX_SCALE, Math.max(minScaleRef.current, next.scale));
    const cam = { ...next, scale };
    cameraRef.current = cam;
    setCamera(cam);
  }, []);

  // Zoom by `factor`, keeping the world point under screen point (px, py) fixed.
  const zoomAt = useCallback(
    (factor, px, py) => {
      const cam = cameraRef.current;
      const sz = sizeRef.current;
      if (!cam || !sz) return;
      const scale = Math.min(MAX_SCALE, Math.max(minScaleRef.current, cam.scale * factor));
      const wx = cam.cx + (px - sz.width / 2) / cam.scale;
      const wy = cam.cy - (py - sz.height / 2) / cam.scale;
      applyCamera({
        scale,
        cx: wx - (px - sz.width / 2) / scale,
        cy: wy + (py - sz.height / 2) / scale,
      });
    },
    [applyCamera],
  );

  useImperativeHandle(ref, () => ({
    zoomIn: () => sizeRef.current && zoomAt(1.6, sizeRef.current.width / 2, sizeRef.current.height / 2),
    zoomOut: () => sizeRef.current && zoomAt(1 / 1.6, sizeRef.current.width / 2, sizeRef.current.height / 2),
    reset: () => sizeRef.current && applyCamera(fitCamera(sizeRef.current.width, sizeRef.current.height)),
    focusStation: (station, minScale = 0.25) => {
      const cam = cameraRef.current;
      if (!cam) return;
      const scale = Math.max(cam.scale, minScale);
      // sit the stop in the upper part of the screen so the info card doesn't cover it
      const lift = (sizeRef.current?.height ?? 0) * 0.18;
      applyCamera({ scale, cx: station.x, cy: station.y - lift / scale });
    },
  }));

  const hitTest = useCallback((px, py) => {
    const cam = cameraRef.current;
    const sz = sizeRef.current;
    let best = null;
    let bestD = HIT_RADIUS;
    for (const s of stations) {
      const sx = (s.x - cam.cx) * cam.scale + sz.width / 2;
      const sy = (cam.cy - s.y) * cam.scale + sz.height / 2;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }, []);

  // ---- gestures: one finger pans, two fingers pinch-zoom, a still tap selects a stop
  // Page position of the map's top-left corner, so touch pageX/pageY can be made local.
  const pageOrigin = useRef({ x: 0, y: 0 });
  const measureOrigin = useCallback(() => {
    containerRef.current?.measure?.((x, y, w, h, pageX, pageY) => {
      if (Number.isFinite(pageX)) pageOrigin.current = { x: pageX, y: pageY };
    });
  }, []);
  const toLocal = (t) => ({ x: t.pageX - pageOrigin.current.x, y: t.pageY - pageOrigin.current.y });

  const gesture = useRef(null);
  const responder = useMemo(() => {
    const handleMove = (evt) => {
      const g = gesture.current;
      const cam = cameraRef.current;
      const sz = sizeRef.current;
      if (!g || !cam || !sz) return;
      const touches = evt.nativeEvent.touches?.length ? evt.nativeEvent.touches : [evt.nativeEvent];

      // Restart the baseline whenever the number of fingers changes.
      if (touches.length !== g.count) {
        g.count = touches.length;
        g.cam = cam;
        if (touches.length >= 2) {
          g.moved = true;
          g.dist = distance(touches[0], touches[1]);
          const m = midpoint(touches[0], touches[1]);
          g.mid = toLocal({ pageX: m.x, pageY: m.y });
        } else {
          g.start = { x: touches[0].pageX, y: touches[0].pageY };
          if (!g.tap) g.tap = toLocal(touches[0]);
        }
        return;
      }

      if (touches.length >= 2) {
        const m = midpoint(touches[0], touches[1]);
        const mid = toLocal({ pageX: m.x, pageY: m.y });
        const scale = Math.min(MAX_SCALE, Math.max(minScaleRef.current, g.cam.scale * (distance(touches[0], touches[1]) / g.dist)));
        // the world point that was under the starting midpoint stays under the current midpoint
        const wx = g.cam.cx + (g.mid.x - sz.width / 2) / g.cam.scale;
        const wy = g.cam.cy - (g.mid.y - sz.height / 2) / g.cam.scale;
        applyCamera({ scale, cx: wx - (mid.x - sz.width / 2) / scale, cy: wy + (mid.y - sz.height / 2) / scale });
      } else {
        const dx = touches[0].pageX - g.start.x;
        const dy = touches[0].pageY - g.start.y;
        if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) g.moved = true;
        if (g.moved) applyCamera({ scale: g.cam.scale, cx: g.cam.cx - dx / g.cam.scale, cy: g.cam.cy + dy / g.cam.scale });
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        measureOrigin();
        gesture.current = { count: 0, moved: false };
        handleMove(evt);
      },
      onPanResponderMove: handleMove,
      onPanResponderRelease: () => {
        const g = gesture.current;
        if (g && !g.moved && g.tap) {
          const hit = hitTest(g.tap.x, g.tap.y);
          onSelectRef.current?.(hit ? hit.id : null);
        }
        gesture.current = null;
      },
      onPanResponderTerminate: () => {
        gesture.current = null;
      },
    });
  }, [applyCamera, hitTest, measureOrigin]);

  const onLayout = useCallback(
    (e) => {
      const { width, height } = e.nativeEvent.layout;
      setSize({ width, height });
      sizeRef.current = { width, height };
      const fit = fitCamera(width, height);
      minScaleRef.current = fit.scale * 0.6;
      if (!cameraRef.current) applyCamera(fit);
      measureOrigin();
    },
    [applyCamera, measureOrigin],
  );

  // Mouse-wheel / trackpad zoom when running on the web.
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = containerRef.current;
    if (!node?.addEventListener) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = node.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - rect.left, e.clientY - rect.top);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [zoomAt, size]);

  // ---- projection of everything to screen space for the current camera
  const projected = useMemo(() => {
    if (!camera || !size) return null;
    const { scale, cx, cy } = camera;
    const ox = size.width / 2;
    const oy = size.height / 2;
    const px = (x) => (x - cx) * scale + ox;
    const py = (y) => (cy - y) * scale + oy;
    const margin = 60;
    const visible = (x, y) => x > -margin && y > -margin && x < size.width + margin && y < size.height + margin;

    const lines = tracks.map((t, i) => ({
      key: i,
      line: t.line,
      points: t.points.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' '),
    }));
    const stops = stations
      .map((s) => ({ station: s, x: px(s.x), y: py(s.y) }))
      .filter((p) => visible(p.x, p.y));
    return { lines, stops };
  }, [camera, size]);

  const scale = camera?.scale ?? 0;
  const trackWidth = Math.min(12, Math.max(3.5, scale * 14));
  const iconRadius = Math.min(13, Math.max(5, scale * 22));
  const showAllLabels = scale >= LABEL_SCALE;

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={onLayout}
      {...responder.panHandlers}
    >
      {projected && (
        <Svg width={size.width} height={size.height} pointerEvents="none">
          {/* background: every rapid transit line, muted */}
          <G opacity={0.28}>
            {projected.lines
              .filter((l) => l.line !== 'Green')
              .map((l) => (
                <Polyline
                  key={l.key}
                  points={l.points}
                  fill="none"
                  stroke={LINE_COLORS[l.line] ?? '#888'}
                  strokeWidth={trackWidth * 0.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
          </G>
          {/* Green Line track */}
          {projected.lines
            .filter((l) => l.line === 'Green')
            .map((l) => (
              <Polyline
                key={l.key}
                points={l.points}
                fill="none"
                stroke={LINE_COLORS.Green}
                strokeWidth={trackWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          {/* stops */}
          {projected.stops.map(({ station, x, y }) => (
            <StationTarget
              key={station.id}
              x={x}
              y={y}
              radius={iconRadius}
              transfer={station.transfers.length > 0}
              selected={station.id === selectedId}
            />
          ))}
          {/* labels */}
          {projected.stops
            .filter(
              ({ station }) =>
                showAllLabels || station.terminus || station.transfers.length > 0 || station.id === selectedId || station.name === 'Kenmore',
            )
            .map(({ station, x, y }) => (
              <G key={`l-${station.id}`}>
                <SvgText
                  x={x + iconRadius + 4}
                  y={y + 4}
                  fontSize={12}
                  fontFamily={LABEL_FONT}
                  fontWeight="700"
                  stroke="#fff"
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                  fill="#fff"
                >
                  {station.name}
                </SvgText>
                <SvgText x={x + iconRadius + 4} y={y + 4} fontSize={12} fontFamily={LABEL_FONT} fontWeight="700" fill="#1c1c1c">
                  {station.name}
                </SvgText>
              </G>
            ))}
        </Svg>
      )}
    </View>
  );
});

export default TransitMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EA',
    overflow: 'hidden',
    userSelect: 'none',
  },
});
