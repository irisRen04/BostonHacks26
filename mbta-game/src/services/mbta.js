const BASE = "https://api-v3.mbta.com";
const KEY = process.env.EXPO_PUBLIC_MBTA_KEY;

// Stops near the user (same style of request that worked before)
export async function getNearbyStops({ lat, lng }, radius = 0.05) {
  let url =
    `${BASE}/stops?filter[latitude]=${lat}&filter[longitude]=${lng}` +
    `&filter[radius]=${radius}&filter[route_type]=0,1`;
  if (KEY) url += `&api_key=${KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`MBTA API error: ${res.status}`);
  const json = await res.json();

  // Slim down, and drop duplicates with the same name
  const seen = new Set();
  return json.data
    .map((s) => ({
      id: s.id,
      name: s.attributes.name,
      lat: s.attributes.latitude,
      lng: s.attributes.longitude,
    }))
    .filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
}