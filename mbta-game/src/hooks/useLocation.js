import { useState, useEffect } from "react";
import { watchLocation } from "../services/Location";

export function useLocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stop = null;
    let cancelled = false;

    watchLocation(setCoords, (err) => setError(err.message)).then((fn) => {
      if (cancelled) fn();
      else stop = fn;
    });

    return () => {
      cancelled = true;
      if (stop) stop();
    };
  }, []);

  return { coords, error };
}