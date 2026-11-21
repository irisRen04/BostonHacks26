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
