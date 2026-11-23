const WALK_SPEED_M_PER_MIN = 80; // about 3 mph

// Real street-walking distance and time between two points.
// Returns { meters, minutes, exact: true }, or null if the request fails.
export async function getWalkingRoute(from, to) {
  const url =
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const meters = json.routes?.[0]?.distance;
    if (typeof meters !== 'number') return null;
    return { meters, minutes: Math.max(1, Math.ceil(meters / WALK_SPEED_M_PER_MIN)), exact: true };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}