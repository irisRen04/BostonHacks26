import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "./useLocation";
import { getNearbyStops } from "../services/mbta";
import { distanceMeters } from "../services/Location";
import { addDistances } from "../services/proximity";

export function useNearbyStops() {
  const { coords, error } = useLocation();
  const [stops, setStops] = useState([]);
  const lastFetch = useRef(null);

  useEffect(() => {
    if (!coords) return;
    if (lastFetch.current && distanceMeters(lastFetch.current, coords) < 100) {
      return;
    }
    lastFetch.current = coords;
    getNearbyStops(coords).then(setStops).catch(console.error);
  }, [coords]);

  const stopsWithDistance = useMemo(
    () => (coords ? addDistances(stops, coords) : []),
    [stops, coords]
  );

  return { coords, error, stops: stopsWithDistance };
}