// Green Line graph generated from the MBTA ArcGIS shapefiles by
// scripts/build_green_line.py. Each station:
//   { id, name, line, branches, order: {B: n, ...}, x, y, terminus, transfers,
//     left: [ids], right: [ids], up: [ids], down: [ids] }
// Orientation: at Kenmore the C branch is left, B is up, D is down, downtown is right.
import data from './greenLine.json';

export const LINE_COLORS = {
  Green: '#00843D',
  Red: '#DA291C',
  Orange: '#ED8B00',
  Blue: '#003DA5',
  Silver: '#7C878E',
};

export const DIRECTIONS = ['up', 'left', 'right', 'down'];

export const stations = data.stations;
export const stationsById = Object.fromEntries(stations.map((s) => [s.id, s]));
export const branches = data.branches;
export const tracks = data.tracks;
export const greenBounds = data.bounds;

/** Every stop directly connected to `id`, in up/left/right/down order. */
export function neighborsOf(id) {
  const s = stationsById[id];
  return DIRECTIONS.flatMap((d) => s[d]);
}

/** A junction is where the line splits: more than two connected stops (Kenmore, Copley, Lechmere). */
export function isJunction(id) {
  return neighborsOf(id).length > 2;
}

/**
 * Ways out of a stop. For each neighbour: which branches run from `id` to it,
 * and the terminus each of those branches heads toward.
 *   routeOptions('kenmore') -> [{ id: 'blandford-street', branches: ['B'], toward: ['Boston College'] }, ...]
 */
export function routeOptions(id) {
  return neighborsOf(id).map((next) => {
    const via = [];
    const toward = [];
    for (const [branch, seq] of Object.entries(branches)) {
      const i = seq.indexOf(id);
      const j = seq.indexOf(next);
      if (i === -1 || j === -1 || Math.abs(i - j) !== 1) continue;
      via.push(branch);
      const end = stationsById[j > i ? seq[seq.length - 1] : seq[0]].name;
      if (!toward.includes(end)) toward.push(end);
    }
    return { id: next, branches: via, toward };
  });
}
