import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "./useLocation";
import { getNearbyStops } from "../services/mbta";
import { distanceMeters } from "../services/Location";
import { rankStops } from "../services/proximity";

export function useRankedStops() {
  const { coords, error: locationError } = useLocation();
  const [stops, setStops] = useState([]);
  const [apiError, setApiError] = useState(null);
  const lastFetch = useRef(null);

  // Fetch stops once we have a location, and again after moving 500+ m
  useEffect(() => {
    if (!coords) return;
    if (lastFetch.current && distanceMeters(lastFetch.current, coords) < 500) {
      return;
    }
    lastFetch.current = coords;
    getNearbyStops(coords)
      .then(setStops)
      .catch((e) => setApiError(e.message));
  }, [coords]);

  const ranked = useMemo(
    () => (coords && stops.length ? rankStops(stops, coords) : []),
    [coords, stops]
  );

  return { coords, ranked, stopCount: stops.length, error: locationError || apiError };
}