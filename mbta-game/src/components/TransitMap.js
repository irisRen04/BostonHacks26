import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { greenBounds, stations, stationsById, tracks } from '../data/greenLine';
import {
  FONT_TITLE,
  LINE_PIXEL_COLORS,
  PALETTE,
  PX,
  STOP_SPRITE,
  STOP_SPRITE_SMALL,
  TRANSFER_SPRITE,
  TRANSFER_SPRITE_SMALL,
  cellsToPath,
  rasterize,
  squaresToPath,
  stampSprite,
  topEdge,
} from '../theme/pixel';
import JunctionSigns, { SIGN_CLEAR_RADIUS, hitSign, layoutSigns } from './JunctionSigns';
import PlayerAvatar, { PLAYER_HEIGHT } from './PlayerAvatar';

const TAP_SLOP = 8; // px a finger may move and still count as a tap
const HIT_RADIUS = 26; // px around a stop that counts as touching it
const MAX_SCALE = 1.6; // px per meter at full zoom-in
const LABEL_SCALE = 0.09; // zoom level at which every stop gets a name label

// "Park Street" and "park st." style differences shouldn't break matching
const normName = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Chunkier track and bigger stop sprites as you zoom in.
function zoomStyle(scale) {
  if (scale < 0.05) return { track: 1, sprite: STOP_SPRITE_SMALL, transfer: TRANSFER_SPRITE_SMALL, s: 2 };
  if (scale < 0.15) return { track: 2, sprite: STOP_SPRITE, transfer: TRANSFER_SPRITE, s: 2 };
  if (scale < 0.5) return { track: 3, sprite: STOP_SPRITE, transfer: TRANSFER_SPRITE, s: 3 };
  return { track: 4, sprite: STOP_SPRITE, transfer: TRANSFER_SPRITE, s: 4 };
}

// Ground texture tile, in map pixels: [x, y, colour]
const GROUND_TILE = 8;
const GROUND_SPECKS = [
  [1, 2, PALETTE.groundSpeck],
  [5, 6, PALETTE.groundSpeck],
  [6, 1, PALETTE.groundDark],
  [2, 5, PALETTE.groundDark],
  [3, 3, PALETTE.groundDark],
  [7, 4, PALETTE.groundSpeck],
];

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
 *
 * Props:
 *   selectedId        - station the user tapped (highlighted nameplate)
 *   onSelectStation   - called with a station id (or null) when the map is tapped
 *   playerStationName - name of the nearest stop to the user; the trolley sits here
 */
const TransitMap = forwardRef(function TransitMap(
  { selectedId, onSelectStation, playerStationName },
  ref,
) {
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
  const onSignRef = useRef(onSignPress);
  onSignRef.current = onSignPress;
  const placedSignsRef = useRef([]);

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
          const sign = hitSign(placedSignsRef.current, g.tap.x, g.tap.y);
          if (sign) {
            onSignRef.current?.(sign.id);
          } else {
            const hit = hitTest(g.tap.x, g.tap.y);
            onSelectRef.current?.(hit ? hit.id : null);
          }
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

  // ---- rasterize everything into screen-space pixels for the current camera
  const projected = useMemo(() => {
    if (!camera || !size) return null;
    const { scale, cx, cy } = camera;
    const { width, height } = size;
    // World origin on screen; the pixel grid is anchored to it so pixels slide with the map.
    const OX = width / 2 - cx * scale;
    const OY = height / 2 + cy * scale;
    const gox = Math.round(((OX % PX) + PX) % PX) - PX;
    const goy = Math.round(((OY % PX) + PX) % PX) - PX;
    const toScreen = (pts) => pts.map(([x, y]) => [x * scale + OX, -y * scale + OY]);
    const style = zoomStyle(scale);

    // other lines: flat, muted, one size thinner
    const others = {};
    for (const t of tracks) {
      if (t.line === 'Green') continue;
      (others[t.line] ??= []).push(toScreen(t.points));
    }
    const otherPaths = Object.entries(others).map(([line, polys]) => ({
      line,
      d: cellsToPath(rasterize(polys, Math.max(1, style.track - 1), gox, goy, width, height), gox, goy),
    }));

    // Green Line: dark outline, fill, and a light bevel on the top edge
    const green = tracks.filter((t) => t.line === 'Green').map((t) => toScreen(t.points));
    const fill = rasterize(green, style.track, gox, goy, width, height);
    const greenPaths = {
      outline: cellsToPath(rasterize(green, style.track + 2, gox, goy, width, height), gox, goy),
      fill: cellsToPath(fill, gox, goy),
      highlight: style.track >= 2 ? cellsToPath(topEdge(fill), gox, goy) : '',
    };

    // stops, snapped to the pixel grid
    const margin = 40;
    const stops = [];
    const sprites = {};
    for (const st of stations) {
      const sx = st.x * scale + OX;
      const sy = -st.y * scale + OY;
      if (sx < -margin || sy < -margin || sx > width + margin || sy > height + margin) continue;
      const x = gox + (Math.floor((sx - gox) / PX) + 0.5) * PX;
      const y = goy + (Math.floor((sy - goy) / PX) + 0.5) * PX;
      stops.push({ station: st, x, y });
      stampSprite(sprites, st.transfers.length ? style.transfer : style.sprite, x, y, style.s);
    }
    const spritePaths = Object.entries(sprites).map(([color, sq]) => ({ color, d: squaresToPath(sq) }));
    const spriteHalf = (style.sprite.length * style.s) / 2;

    const stationToScreen = (st) => ({ x: st.x * scale + OX, y: -st.y * scale + OY });
    return { gox, goy, otherPaths, greenPaths, stops, spritePaths, spriteHalf, stationToScreen };
  }, [camera, size]);

  const scale = camera?.scale ?? 0;
  const showAllLabels = scale >= LABEL_SCALE;

  // The rider sits at the stop nearest the user (matched by name)
  const playerKey = normName(playerStationName);
  const isPlayerStation = (station) => playerKey !== '' && normName(station.name) === playerKey;
  const playerStop =
  projected?.stops.find((p) => isPlayerStation(p.station)) ??
  projected?.stops.find((p) => p.station.id === selectedId);

  return (
    <View ref={containerRef} style={styles.container} onLayout={onLayout} {...responder.panHandlers}>
      {projected && (
        <Svg width={size.width} height={size.height} pointerEvents="none" shapeRendering="crispEdges">
          <Defs>
            <Pattern
              id="ground"
              patternUnits="userSpaceOnUse"
              x={projected.gox}
              y={projected.goy}
              width={GROUND_TILE * PX}
              height={GROUND_TILE * PX}
            >
              <Rect width={GROUND_TILE * PX} height={GROUND_TILE * PX} fill={PALETTE.ground} />
              {GROUND_SPECKS.map(([x, y, c]) => (
                <Rect key={`${x}-${y}`} x={x * PX} y={y * PX} width={PX} height={PX} fill={c} />
              ))}
            </Pattern>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#ground)" />

          {/* the rest of the MBTA, muted */}
          <G opacity={0.45}>
            {projected.otherPaths.map(({ line, d }) => (
              <Path key={line} d={d} fill={LINE_PIXEL_COLORS[line] ?? PALETTE.silver} />
            ))}
          </G>

          {/* Green Line track */}
          <Path d={projected.greenPaths.outline} fill={PALETTE.greenDark} />
          <Path d={projected.greenPaths.fill} fill={PALETTE.green} />
          {projected.greenPaths.highlight ? <Path d={projected.greenPaths.highlight} fill={PALETTE.greenLight} /> : null}

          {/* stop sprites */}
          {projected.spritePaths.map(({ color, d }) => (
            <Path key={color} d={d} fill={color} />
          ))}

          {/* nameplates */}
          {projected.stops
            .filter(
              ({ station }) =>
                showAllLabels ||
                station.terminus ||
                station.transfers.length > 0 ||
                station.id === selectedId ||
                isPlayerStation(station) ||
                station.name === 'Kenmore',
            )
            // while junction signs are up, clear nameplates around the junction so the signs read clearly
            .filter(({ station, x, y }) => {
              if (!placedSigns.length) return true;
              // nearest point of the nameplate box to the junction
              const left = x;
              const right = x + projected.spriteHalf + 4 + station.name.length * LABEL_SIZE + 8;
              const nx = Math.min(Math.max(current.x, left), right);
              const ny = Math.min(Math.max(current.y, y - 8), y + 8);
              return Math.hypot(nx - current.x, ny - current.y) > SIGN_CLEAR_RADIUS;
            })
            .map(({ station, x, y }) => (
              <Nameplate
                key={`l-${station.id}`}
                x={Math.round(x + projected.spriteHalf + 4)}
                y={Math.round(y)}
                text={station.name.toUpperCase()}
                active={station.id === selectedId}
              />
            ))}

          {/* the rider, at the nearest stop to the user */}
          {playerStop && <PlayerTrolley x={playerStop.x} y={playerStop.y - projected.spriteHalf - 26} />}
        </Svg>
      )}
    </View>
  );
});

const LABEL_SIZE = 8; // Press Start 2P is drawn on an 8px grid and is monospaced

function Nameplate({ x, y, text, active }) {
  const w = text.length * LABEL_SIZE + 8;
  const h = LABEL_SIZE + 8;
  return (
    <G>
      <Rect x={x + 2} y={y - h / 2 + 2} width={w} height={h} fill={PALETTE.ink} opacity={0.35} />
      <Rect x={x} y={y - h / 2} width={w} height={h} fill={active ? PALETTE.gold : PALETTE.ink} />
      <SvgText
        x={x + 4}
        y={y + LABEL_SIZE / 2}
        fontSize={LABEL_SIZE}
        fontFamily={FONT_TITLE}
        fill={active ? PALETTE.ink : PALETTE.white}
      >
        {text}
      </SvgText>
    </G>
  );
}

export default TransitMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.ground,
    overflow: 'hidden',
    userSelect: 'none',
  },
});