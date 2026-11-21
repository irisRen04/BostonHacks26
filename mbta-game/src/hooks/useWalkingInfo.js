import { useEffect, useRef, useState } from 'react';
import { getWalkingRoute } from '../services/walking';
import { distanceMeters } from '../services/Location';

// stops: [{ id, lat, lng }]. Returns { [id]: { meters, minutes, exact } }
export function useWalkingInfo(coords, stops) {
  const [byId, setById] = useState({});
  const last = useRef(null);
  const key = stops.map((s) => s.id).join(',');

  useEffect(() => {
    if (!coords || stops.length === 0) return;
    const sameStops = last.current?.key === key;
    if (sameStops && distanceMeters(last.current.coords, coords) < 75) return;
    last.current = { key, coords };

    Promise.all(
      stops.map(async (s) => [s.id, await getWalkingRoute(coords, s)]),
    ).then((entries) => {
      const found = entries.filter(([, route]) => route);
      if (found.length) setById((prev) => ({ ...prev, ...Object.fromEntries(found) }));
    });
  }, [coords, key]);

  return byId;
}