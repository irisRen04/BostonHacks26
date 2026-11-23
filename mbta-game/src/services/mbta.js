const BASE = "https://api-v3.mbta.com";
const KEY = process.env.EXPO_PUBLIC_MBTA_KEY;

// Stops near the user (same style of request that worked before)
let cache = null;

// All Green Line stops, no radius, fetched once
export async function getNearbyStops() {
  if (cache) return cache;

  let url = `${BASE}/stops?filter[route]=Green-B,Green-C,Green-D,Green-E`;
  if (KEY) url += `&api_key=${KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`MBTA API error: ${res.status}`);
  const json = await res.json();

  // Prefer parent stations (location_type 1), then drop duplicate names
  const rows = [...json.data].sort(
    (a, b) => (b.attributes.location_type === 1) - (a.attributes.location_type === 1),
  );
  const seen = new Set();
  cache = rows
    .map((s) => ({
      id: s.id,
      name: s.attributes.name,
      lat: s.attributes.latitude,
      lng: s.attributes.longitude,
    }))
    .filter((s) => (seen.has(s.name) ? false : seen.add(s.name)));
  return cache;
}