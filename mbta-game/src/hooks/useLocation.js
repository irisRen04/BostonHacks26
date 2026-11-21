import { useState, useEffect } from "react";
import { watchLocation } from "../services/Location";

export function useLocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const stop = watchLocation(setCoords, (err) => setError(err.message));
    return stop; // cleanup when the component unmounts
  }, []);

  return { coords, error };
}