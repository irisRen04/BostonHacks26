import { distanceMeters } from "./Location";

const WALK_SPEED_M_PER_MIN = 80; // about 3 mph

// Adds distance + walk time to each stop and sorts nearest first
export function rankStops(stops, userCoords) {
  return stops
    .map((stop) => {
      const meters = distanceMeters(userCoords, stop);
      return {
        ...stop,
        meters,
        walkMinutes: Math.ceil(meters / WALK_SPEED_M_PER_MIN),
      };
    })
    .sort((a, b) => a.meters - b.meters);
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}