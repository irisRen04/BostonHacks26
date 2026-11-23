// Latitude/longitude -> NAD83 Massachusetts State Plane meters (EPSG:26986),
// the coordinate system the whole map uses. Lambert conformal conic, same math
// as scripts/build_areas.py.
const A = 6378137.0;
const F = 1 / 298.257222101;
const E = Math.sqrt(2 * F - F * F);
const rad = (d) => (d * Math.PI) / 180;
const P1 = rad(41 + 43 / 60);
const P2 = rad(42 + 41 / 60);
const P0 = rad(41);
const L0 = rad(-71.5);

const m = (p) => Math.cos(p) / Math.sqrt(1 - (E * Math.sin(p)) ** 2);
const t = (p) => Math.tan(Math.PI / 4 - p / 2) / ((1 - E * Math.sin(p)) / (1 + E * Math.sin(p))) ** (E / 2);

const N = (Math.log(m(P1)) - Math.log(m(P2))) / (Math.log(t(P1)) - Math.log(t(P2)));
const FF = m(P1) / (N * t(P1) ** N);
const RHO0 = A * FF * t(P0) ** N;

/** Returns { x, y } in State Plane meters. */
export function project(lat, lon) {
  const rho = A * FF * t(rad(lat)) ** N;
  const th = N * (rad(lon) - L0);
  return { x: 200000 + rho * Math.sin(th), y: 750000 + RHO0 - rho * Math.cos(th) };
}
