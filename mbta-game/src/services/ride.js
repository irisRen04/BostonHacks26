import { routeOptions } from '../data/greenLine';
import { distanceMeters } from './Location';

const TRAIN_M_PER_MIN = 350; // Green Line average speed, roughly 13 mph
const DWELL_MIN = 0.5;       // time spent at each stop

// Shortest hop-path between two station ids, following the map's connections
function findPath(fromId, toId) {
  const prev = { [fromId]: null };
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift();
    if (id === toId) break;
    let next = [];
    try {
      next = routeOptions(id).map((o) => o.id);
    } catch {
      next = [];
    }
    for (const n of next) {
      if (!(n in prev)) {
        prev[n] = id;
        queue.push(n);
      }
    }
  }
  if (!(toId in prev)) return null;
  const path = [];
  for (let id = toId; id; id = prev[id]) path.unshift(id);
  return path;
}

// coordsById: { [stationId]: { lat, lng } }
// Returns { meters, minutes, stops } or null if no route is found
export function rideBetween(fromId, toId, coordsById) {
  if (fromId === toId) return { meters: 0, minutes: 0, stops: 0 };
  const path = findPath(fromId, toId);
  if (!path) return null;

  let meters = 0;
  for (let i = 1; i < path.length; i++) {
    const a = coordsById[path[i - 1]];
    const b = coordsById[path[i]];
    if (!a || !b) return null;
    meters += distanceMeters(a, b);
  }
  const stops = path.length - 1;
  return {
    meters,
    stops,
    minutes: Math.max(1, Math.round(meters / TRAIN_M_PER_MIN + stops * DWELL_MIN)),
  };
}