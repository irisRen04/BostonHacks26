import { useState, useEffect } from "react";
import { useLocation } from "../hooks/useLocation";
import { getNearbyStops } from "../services/mbta";

export default function NearbyStops() {
  const { coords, error } = useLocation();
  const [stops, setStops] = useState([]);

  useEffect(() => {
    if (!coords) return;
    getNearbyStops(coords).then(setStops).catch(console.error);
  }, [coords]);

  if (error) return <p>Location error: {error}</p>;
  if (!coords) return <p>Finding you...</p>;

  return (
    <ul>
      {stops.map((s) => (
        <li key={s.id}>{s.attributes.name}</li>
      ))}
    </ul>
  );
}