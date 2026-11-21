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
  fillRings,
  rasterize,
  squaresToPath,
  stampSprite,
  topEdge,
} from '../theme/pixel';
import { landmarks } from '../data/landmarks';
import parks from '../data/parks.json';
import sea from '../data/sea.json';
import water from '../data/water.json';
import LiveTrains from './LiveTrains';
import JunctionSigns, { SIGN_CLEAR_RADIUS, hitSign, layoutSigns } from './JunctionSigns';
import { AnimatedLandmarkPaths, LANDMARK_PIN, LandmarkPin } from './LandmarkSprite';
import PlayerAvatar, { PLAYER_HEIGHT } from './PlayerAvatar';

const TAP_SLOP = 8; // px a finger may move and still count as a tap
const HIT_RADIUS = 26; // px around a stop that counts as touching it
const MAX_SCALE = 1.6; // px per meter at full zoom-in
const PAN_MARGIN = 3000; // m the view centre may go past the Green Line's outermost stops
const LABEL_SCALE = 0.09; // zoom level at which every stop gets a name label
const LANDMARK_SCALE = 0.09; // landmarks appear once you zoom in this far...
const PIN_UNTIL = 0.25; // ...as small pins, until you're close enough for the building to fit

// How a landmark is drawn at this zoom: a pin, or its building growing from 1 to 3 points per pixel.
function landmarkLook(scale) {
  if (scale < PIN_UNTIL) return { pin: true, px: 2 };
  return { pin: false, px: scale < 0.5 ? 1 : scale < 1 ? 2 : 3 };
}

// Chunkier track and bigger stop sprites as you zoom in.
function zoomStyle(scale) {
  if (scale < 0.05) return { track: 1, sprite: STOP_SPRITE_SMALL, transfer: TRANSFER_SPRITE_SMALL, s: 2 };
  if (scale < 0.15) return { track: 2, sprite: STOP_SPRITE, transfer: TRANSFER_SPRITE, s: 2 };
  if (scale < 0.5) return { track: 3, sprite: STOP_SPRITE, transfer: TRANSFER_SPRITE, s: 3 };
  return { track: 4, sprite: STOP_SPRITE, transfer: TRANSFER_SPRITE, s: 4 };
}

// Water texture tile, in map pixels: short light wave dashes and a deep speck
const WAVE_TILE = 8;
const WAVES = [
  [1, 1, PALETTE.waterLight],
  [2, 1, PALETTE.waterLight],
  [5, 4, PALETTE.waterLight],
  [6, 4, PALETTE.waterLight],
  [3, 6, PALETTE.waterDeep],
];

// Park texture tile: two little pixel trees (dark crown, one light pixel)
const PARK_TILE = 10;
const TREES = [
  [2, 2, PALETTE.tree],
  [3, 2, PALETTE.tree],
  [2, 3, PALETTE.tree],
  [3, 3, PALETTE.tree],
  [2, 2, PALETTE.treeLight],
  [7, 6, PALETTE.tree],
  [8, 6, PALETTE.tree],
  [7, 7, PALETTE.tree],
  [8, 7, PALETTE.tree],
  [7, 6, PALETTE.treeLight],
];

// Every water / park ring, flattened once (outer edges and holes; filled even-odd)
const WATER_RINGS = water.bodies.flatMap((b) => b.rings);
const PARK_RINGS = parks.bodies.flatMap((b) => b.rings);
// Boston Harbor: sea areas plus islands (holes), and the coastline for beaches.
// Filled separately from lakes/rivers so overlaps don't cancel out under even-odd.
const SEA_RINGS = sea.rings;
const COAST_LINES = sea.coast;
const closeRings = (rings) => rings.map((r) => [...r, r[0]]);

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
 */
/**
 * signs / activeSignId / onSignPress: at a junction, the signposts to draw around the
 * current stop (see JunctionSigns). Tapping a sign calls onSignPress(neighbourId).
 */
const TransitMap = forwardRef(function TransitMap(
  {
    selectedId,
    onSelectStation,
    avatar,
    signs,
    activeSignId,
    onSignPress,
    discovered,
    onLandmarkPress,
    liveTrains = [],
    waitingFor,
    selectedTrainId,
    onTrainPress,
  },
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
  const onLandmarkRef = useRef(onLandmarkPress);
  onLandmarkRef.current = onLandmarkPress;
  const landmarkHitsRef = useRef([]);
  const onTrainRef = useRef(onTrainPress);
  onTrainRef.current = onTrainPress;
  const trainHitsRef = useRef([]);

  const applyCamera = useCallback((next) => {
    const scale = Math.min(MAX_SCALE, Math.max(minScaleRef.current, next.scale));
    // keep the view centred near the Green Line so you can't scroll off into empty map
    const cam = {
      scale,
      cx: Math.min(greenBounds.maxX + PAN_MARGIN, Math.max(greenBounds.minX - PAN_MARGIN, next.cx)),
      cy: Math.min(greenBounds.maxY + PAN_MARGIN, Math.max(greenBounds.minY - PAN_MARGIN, next.cy)),
    };
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

  const hitTest = useCallback((px, py, radius = HIT_RADIUS) => {
    const cam = cameraRef.current;
    const sz = sizeRef.current;
    let best = null;
    let bestD = radius;
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
          // what was tapped, most specific first: a sign, right on a stop, a train, a landmark, near a stop
          const inBox = (h) => g.tap.x >= h.x0 && g.tap.x <= h.x1 && g.tap.y >= h.y0 && g.tap.y <= h.y1;
          const sign = hitSign(placedSignsRef.current, g.tap.x, g.tap.y);
          const exactStop = sign ? null : hitTest(g.tap.x, g.tap.y, 10);
          const train = sign || exactStop ? null : trainHitsRef.current.find(inBox);
          const landmark = sign || exactStop || train ? null : landmarkHitsRef.current.find(inBox);
          if (sign) {
            onSignRef.current?.(sign.id);
          } else if (exactStop) {
            onSelectRef.current?.(exactStop.id);
          } else if (train) {
            onTrainRef.current?.(train.id);
          } else if (landmark) {
            onLandmarkRef.current?.(landmark.id);
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
      minScaleRef.current = fit.scale * 0.9; // a little past "whole line fits"
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

    // parks: a hedge traced around each park, then the treed lawn filled on top
    const parkScreen = PARK_RINGS.map((ring) => toScreen(ring));
    const parkPaths = {
      edge: style.track >= 2 ? cellsToPath(rasterize(closeRings(parkScreen), 2, gox, goy, width, height), gox, goy) : '',
      fill: fillRings(parkScreen, gox, goy, width, height),
    };

    // water: a sandy bank traced along every shore and the coast, then the water filled on top
    const waterScreen = WATER_RINGS.map((ring) => toScreen(ring));
    const banks = [...closeRings(waterScreen), ...COAST_LINES.map((line) => toScreen(line))];
    const waterPaths = {
      // banks only once zoomed in a bit: zoomed all the way out they'd be wider than thin rivers
      shore: style.track >= 2 ? cellsToPath(rasterize(banks, 2, gox, goy, width, height), gox, goy) : '',
      fill: fillRings(waterScreen, gox, goy, width, height),
      sea: fillRings(SEA_RINGS.map((ring) => toScreen(ring)), gox, goy, width, height),
    };

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

    // landmarks, bottom-centre on their real location, only when zoomed in
    const look = landmarkLook(scale);
    const placedLandmarks =
      scale < LANDMARK_SCALE
        ? []
        : landmarks
            .map((lm) => {
              const x = Math.round(lm.x * scale + OX);
              const y = Math.round(-lm.y * scale + OY);
              const art = look.pin ? LANDMARK_PIN : lm.sprite;
              const w = art[0].length * look.px;
              const h = art.length * look.px;
              return { landmark: lm, x, y, w, h, px: look.px, pin: look.pin, // the nameplate to the right of the sprite is tappable too
              hit: { id: lm.id, x0: x - w / 2 - 4, x1: x + w / 2 + 2 + (lm.shortName.length + 2) * LABEL_SIZE + 8, y0: y - h - 4, y1: y + 4 } };
            })
            .filter(({ x, y, w, h }) => x + w > -20 && x - w < width + 20 && y > -20 && y - h < height + 20);

    const stationToScreen = (st) => ({ x: st.x * scale + OX, y: -st.y * scale + OY });
    return { gox, goy, parkPaths, waterPaths, otherPaths, greenPaths, stops, spritePaths, spriteHalf, stationToScreen, placedLandmarks, OX, OY };
  }, [camera, size]);

  const scale = camera?.scale ?? 0;
  const showAllLabels = scale >= LABEL_SCALE;
  if (!liveTrains.length) trainHitsRef.current = []; // no trains drawn, nothing to tap
  const current = projected?.stops.find((p) => p.station.id === selectedId);

  // Junction signposts, laid out around the current stop toward each neighbour.
  const placedSigns = useMemo(() => {
    if (!projected || !current || !signs?.length) return [];
    const positions = Object.fromEntries(signs.map((sg) => [sg.id, projected.stationToScreen(stationsById[sg.id])]));
    return layoutSigns(signs, current, positions);
  }, [projected, current, signs]);
  placedSignsRef.current = placedSigns;
  landmarkHitsRef.current = projected ? projected.placedLandmarks.map((p) => p.hit) : [];
  const signTarget = activeSignId && projected ? projected.stationToScreen(stationsById[activeSignId]) : null;

  // ---- labels: gather every candidate, then place them in priority order. Each label
  // tries the right of its stop first, then the left; if both would overlap a label
  // already placed it's skipped (it comes back when you zoom in). Ties in priority go
  // to the label nearest the middle of the screen.
  const placedLabels = [];
  if (projected) {
    const labelWidth = (text) => text.length * LABEL_SIZE + 8;
    const candidates = [];
    for (const { station, x, y } of projected.stops) {
      const important = station.terminus || station.transfers.length > 0 || station.name === 'Kenmore';
      if (!(showAllLabels || important || station.id === selectedId)) continue;
      const text = station.name.toUpperCase();
      if (placedSigns.length && station.id !== selectedId) {
        // while junction signs are up, keep labels clear of the junction so the signs read clearly
        const right = x + projected.spriteHalf + 4 + labelWidth(text);
        const nx = Math.min(Math.max(current.x, x), right);
        const ny = Math.min(Math.max(current.y, y - 8), y + 8);
        if (Math.hypot(nx - current.x, ny - current.y) <= SIGN_CLEAR_RADIUS) continue;
      }
      candidates.push({
        key: `l-${station.id}`,
        ax: x,
        y: Math.round(y),
        gap: projected.spriteHalf + 4, // room for the stop icon between it and the label
        text,
        active: station.id === selectedId,
        priority: station.id === selectedId ? 0 : important ? 1 : 4,
      });
    }
    for (const { landmark, x, y, w, h } of projected.placedLandmarks) {
      const known = !!discovered?.[landmark.id];
      candidates.push({
        key: `lm-${landmark.id}`,
        ax: x,
        y: Math.round(y - h + 8),
        gap: w / 2 + 2,
        text: known ? `★ ${landmark.shortName}` : '???',
        active: known,
        priority: known ? 2 : 3,
      });
    }
    const cx = size.width / 2;
    const cy = size.height / 2;
    const fromCenter = (c) => Math.hypot(c.ax - cx, c.y - cy);
    candidates.sort((p, q) => p.priority - q.priority || fromCenter(p) - fromCenter(q));
    const boxes = [];
    const PAD = 2;
    const overlaps = (box) => boxes.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0);
    for (const c of candidates) {
      const w = labelWidth(c.text);
      const y0 = c.y - LABEL_SIZE / 2 - 4 - PAD;
      const y1 = c.y + LABEL_SIZE / 2 + 4 + PAD;
      // right of the stop first, then the left
      const spots = [Math.round(c.ax + c.gap), Math.round(c.ax - c.gap - w)];
      let placed = null;
      for (const x of spots) {
        const box = { x0: x - PAD, x1: x + w + PAD, y0, y1 };
        if (box.x1 < 0 || box.x0 > size.width || y1 < 0 || y0 > size.height) continue;
        if (c.priority === 0 || !overlaps(box)) {
          placed = { x, box };
          break;
        }
      }
      if (!placed) continue;
      boxes.push(placed.box);
      placedLabels.push({ ...c, x: placed.x });
    }
  }

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
            <Pattern
              id="parkland"
              patternUnits="userSpaceOnUse"
              x={projected.gox}
              y={projected.goy}
              width={PARK_TILE * PX}
              height={PARK_TILE * PX}
            >
              <Rect width={PARK_TILE * PX} height={PARK_TILE * PX} fill={PALETTE.park} />
              {TREES.map(([x, y, c], i) => (
                <Rect key={i} x={x * PX} y={y * PX} width={PX} height={PX} fill={c} />
              ))}
            </Pattern>
            <Pattern
              id="waves"
              patternUnits="userSpaceOnUse"
              x={projected.gox}
              y={projected.goy}
              width={WAVE_TILE * PX}
              height={WAVE_TILE * PX}
            >
              <Rect width={WAVE_TILE * PX} height={WAVE_TILE * PX} fill={PALETTE.water} />
              {WAVES.map(([x, y, c]) => (
                <Rect key={`${x}-${y}`} x={x * PX} y={y * PX} width={PX} height={PX} fill={c} />
              ))}
            </Pattern>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#ground)" />

          {/* parks */}
          {projected.parkPaths.edge ? <Path d={projected.parkPaths.edge} fill={PALETTE.parkEdge} /> : null}
          {projected.parkPaths.fill ? <Path d={projected.parkPaths.fill} fill="url(#parkland)" /> : null}

          {/* rivers, ponds and reservoirs */}
          {projected.waterPaths.shore ? <Path d={projected.waterPaths.shore} fill={PALETTE.shore} /> : null}
          {projected.waterPaths.sea ? <Path d={projected.waterPaths.sea} fill="url(#waves)" /> : null}
          {projected.waterPaths.fill ? <Path d={projected.waterPaths.fill} fill="url(#waves)" /> : null}

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

          {/* landmarks (under the stops so a nearby stop stays tappable-looking) */}
          {projected.placedLandmarks.map(({ landmark, x, y, px, pin }) => {
            const known = !!discovered?.[landmark.id];
            return pin ? (
              <LandmarkPin key={landmark.id} x={x} y={y} px={px} discovered={known} />
            ) : (
              // undiscovered buildings are faded so they tease rather than compete
              <G key={landmark.id} opacity={known ? 1 : 0.6}>
                <AnimatedLandmarkPaths landmark={landmark} x={x} y={y} px={px} discovered={known} />
              </G>
            );
          })}

          {/* stop sprites */}
          {projected.spritePaths.map(({ color, d }) => (
            <Path key={color} d={d} fill={color} />
          ))}

          {/* live trains (from the MBTA API) */}
          {liveTrains.length > 0 && (
            <LiveTrains
              trains={liveTrains}
              scale={scale}
              OX={projected.OX}
              OY={projected.OY}
              width={size.width}
              height={size.height}
              selectedId={selectedTrainId}
              waitingFor={waitingFor}
              hitsRef={trainHitsRef}
            />
          )}

          {/* nameplates for stops and landmarks, overlapping ones left out (see placedLabels) */}
          {placedLabels.map((l) => (
            <Nameplate key={l.key} x={l.x} y={l.y} text={l.text} active={l.active} />
          ))}

          {/* the rider */}
          {current && (
            <PlayerAvatar avatar={avatar} x={current.x} y={current.y - projected.spriteHalf - PLAYER_HEIGHT / 2 - 2} />
          )}

          {/* junction signposts */}
          {placedSigns.length > 0 && (
            <JunctionSigns
              placed={placedSigns}
              center={current}
              spriteHalf={projected.spriteHalf}
              activeId={activeSignId}
              target={signTarget}
            />
          )}
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
