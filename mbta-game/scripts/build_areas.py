"""
Builds the map's background areas from OpenStreetMap Overpass exports:

    python3 scripts/build_areas.py water /path/to/overpass-water.json   -> src/data/water.json
    python3 scripts/build_areas.py parks /path/to/overpass-parks.json   -> src/data/parks.json

Overpass queries (bbox S,W,N,E around the Green Line, e.g. 42.29,-71.29,42.43,-71.01):

    water: [out:json];( way["natural"="water"](bbox); relation["natural"="water"](bbox); );out geom;
    parks: [out:json];( way["leisure"="park"](bbox); relation["leisure"="park"](bbox); );out geom;

Shapes are converted from lat/lon to NAD83 Massachusetts State Plane meters (the
same coordinates as the stations), simplified, and tiny ponds are dropped.
Data (c) OpenStreetMap contributors, ODbL.
"""
import json
import math
import os
import sys

# ---- lat/lon -> NAD83 / Massachusetts Mainland (EPSG:26986), Lambert conformal conic
A = 6378137.0
F = 1 / 298.257222101
E = math.sqrt(2 * F - F * F)
_r = math.radians
P1, P2, P0, L0 = _r(41 + 43 / 60), _r(42 + 41 / 60), _r(41), _r(-71.5)


def _m(p):
    return math.cos(p) / math.sqrt(1 - (E * math.sin(p)) ** 2)


def _t(p):
    return math.tan(math.pi / 4 - p / 2) / ((1 - E * math.sin(p)) / (1 + E * math.sin(p))) ** (E / 2)


N = (math.log(_m(P1)) - math.log(_m(P2))) / (math.log(_t(P1)) - math.log(_t(P2)))
FF = _m(P1) / (N * _t(P1) ** N)
RHO0 = A * FF * _t(P0) ** N


def project(lat, lon):
    rho = A * FF * _t(_r(lat)) ** N
    th = N * (_r(lon) - L0)
    return 200000 + rho * math.sin(th), 750000 + RHO0 - rho * math.cos(th)


# ---- geometry helpers

MIN_AREA = {'water': 15000, 'parks': 20000}  # m^2; smaller areas are a pixel or two even zoomed in
TOLERANCE = 6  # m; Douglas-Peucker simplification


def area(ring):
    s = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % len(ring)]
        s += x0 * y1 - x1 * y0
    return abs(s) / 2


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        (ax, ay), (bx, by) = pts[i], pts[j]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-9
        best, idx = 0.0, -1
        for k in range(i + 1, j):
            px, py = pts[k]
            dist = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if dist > best:
                best, idx = dist, k
        if best > tol:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(pts, keep) if k]


def join_segments(segments):
    """Stitch way segments (lists of points) into closed rings by matching endpoints."""
    segs = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segs:
        ring = segs.pop()
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[-2::-1]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[:0:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def to_xy(geom):
    return [tuple(round(c, 1) for c in project(g['lat'], g['lon'])) for g in geom]


def main(kind, src, out):
    elements = json.load(open(src))['elements']
    bodies = []  # each: {name, rings: [[x,y],...]} ; rings = outers + inners (even-odd fill)
    for el in elements:
        tags = el.get('tags', {})
        if tags.get('natural') == 'coastline':
            continue  # open sea is not handled yet
        if el['type'] == 'way' and el.get('geometry'):
            pts = to_xy(el['geometry'])
            if pts[0] == pts[-1]:
                bodies.append({'name': tags.get('name', ''), 'rings': [pts]})
        elif el['type'] == 'relation':
            outer = [to_xy(m['geometry']) for m in el.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
            inner = [to_xy(m['geometry']) for m in el.get('members', []) if m.get('role') == 'inner' and m.get('geometry')]
            rings = join_segments(outer) + join_segments(inner)
            if rings:
                bodies.append({'name': tags.get('name', ''), 'rings': rings})

    result = []
    for b in bodies:
        rings = []
        for ring in b['rings']:
            if area(ring) < MIN_AREA[kind]:
                continue
            simple = simplify(ring[:-1], TOLERANCE)
            if len(simple) >= 3:
                rings.append([[round(x), round(y)] for x, y in simple])
        if rings:
            result.append({'name': b['name'], 'rings': rings})

    result.sort(key=lambda b: -sum(area(r) for r in b['rings']))
    with open(out, 'w') as f:
        json.dump({'source': 'OpenStreetMap contributors (ODbL)', 'bodies': result}, f, separators=(',', ':'))
    pts = sum(len(r) for b in result for r in b['rings'])
    print(f'wrote {len(result)} {kind} areas, {pts} points -> {out}')
    for b in result[:12]:
        print(f"  {b['name'] or '(unnamed)'}: {sum(area(r) for r in b['rings']) / 1e6:.2f} km^2")


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    kind = sys.argv[1]
    if kind not in MIN_AREA:
        raise SystemExit('kind must be "water" or "parks"')
    main(kind, sys.argv[2], os.path.join(here, '..', 'src', 'data', f'{kind}.json'))
