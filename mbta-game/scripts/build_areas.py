"""
Builds the map's background areas from OpenStreetMap Overpass exports:

    python3 scripts/build_areas.py water /path/to/overpass-water.json   -> src/data/water.json
    python3 scripts/build_areas.py parks /path/to/overpass-parks.json   -> src/data/parks.json
    python3 scripts/build_areas.py sea   /path/to/overpass-coast.json   -> src/data/sea.json

Overpass queries (bbox S,W,N,E around the Green Line, e.g. 42.29,-71.29,42.43,-71.01):

    water: [out:json];( way["natural"="water"](bbox); relation["natural"="water"](bbox); );out geom;
    parks: [out:json];( way["leisure"="park"](bbox); relation["leisure"="park"](bbox); );out geom;
    sea:   [out:json];way["natural"="coastline"](42.14,-71.41,42.56,-70.69);out geom;  (wider: open sea)

The sea is built from coastline lines (land on the left, water on the right):
they are joined, clipped to the map rectangle, and each sea area is closed by
walking the rectangle's edge clockwise. Islands become holes.

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

MIN_AREA = {'water': 15000, 'parks': 20000, 'sea': 15000}  # m^2; smaller areas are a pixel or two even zoomed in
TOLERANCE = 6  # m; Douglas-Peucker simplification
SEA_TOLERANCE = 12  # m; the coastline covers a much bigger area, so keep it lighter


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


# Map rectangle for the sea, a little inside the downloaded lat/lon box so every
# coastline that crosses it is complete.
SEA_BOX = (42.15, -71.40, 42.55, -70.70)  # south, west, north, east: past anything the map can show


def sea_rect():
    s, w, n, e = SEA_BOX
    sw, se, nw, ne = project(s, w), project(s, e), project(n, w), project(n, e)
    return max(sw[0], nw[0]), max(sw[1], se[1]), min(se[0], ne[0]), min(nw[1], ne[1])


def join_directed(ways):
    """Join coastline ways end-to-start, keeping their direction."""
    chains = [list(w) for w in ways]
    merged = True
    while merged:
        merged = False
        by_start = {c[0]: i for i, c in enumerate(chains)}
        for i, c in enumerate(chains):
            j = by_start.get(c[-1])
            if j is not None and j != i and c[0] != c[-1]:
                chains[i] = c + chains[j][1:]
                chains.pop(j)
                merged = True
                break
    return chains


def build_sea(elements, out):
    xmin, ymin, xmax, ymax = sea_rect()
    W, H = xmax - xmin, ymax - ymin
    PERIM = 2 * (W + H)
    inside = lambda p: xmin <= p[0] <= xmax and ymin <= p[1] <= ymax

    def t_of(p):  # clockwise position along the rectangle edge, starting top-left
        x, y = p
        if abs(y - ymax) < 1e-6:
            return x - xmin
        if abs(x - xmax) < 1e-6:
            return W + (ymax - y)
        if abs(y - ymin) < 1e-6:
            return W + H + (xmax - x)
        return 2 * W + H + (y - ymin)

    corners = [(0, (xmin, ymax)), (W, (xmax, ymax)), (W + H, (xmax, ymin)), (2 * W + H, (xmin, ymin))]

    def clip_point(a, b):  # where segment a(outside)->b(inside) or reverse crosses the rectangle
        best = None
        for axis, val in ((0, xmin), (0, xmax), (1, ymin), (1, ymax)):
            da = b[axis] - a[axis]
            if da == 0:
                continue
            t = (val - a[axis]) / da
            if 0 <= t <= 1:
                q = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
                q = (min(max(q[0], xmin), xmax), min(max(q[1], ymin), ymax))
                if abs(q[0] - (a[0] + t * (b[0] - a[0]))) < 1e-6 and abs(q[1] - (a[1] + t * (b[1] - a[1]))) < 1e-6:
                    if best is None or t < best[0]:
                        best = (t, q)
        return best[1]

    ways = [to_xy(el['geometry']) for el in elements if el.get('geometry')]
    pieces, islands, coast = [], [], []
    for chain in join_directed(ways):
        closed = chain[0] == chain[-1]
        if closed and all(inside(p) for p in chain):
            if area(chain) >= MIN_AREA['sea']:
                ring = simplify(chain[:-1], SEA_TOLERANCE)
                islands.append(ring)
                coast.append(ring + [ring[0]])
            continue
        if closed:  # a loop crossing the edge: start it outside so it clips like an open line
            k = next(i for i, p in enumerate(chain) if not inside(p))
            chain = chain[k:-1] + chain[:k + 1]
        cur = None
        for a, b in zip(chain, chain[1:]):
            ia, ib = inside(a), inside(b)
            if not ia and ib:
                cur = [clip_point(a, b), b]
            elif ia and ib and cur is not None:
                cur.append(b)
            elif ia and not ib and cur is not None:
                cur.append(clip_point(b, a))
                pieces.append(simplify(cur, SEA_TOLERANCE))
                cur = None
    for pc in pieces:
        coast.append(pc)

    # close sea areas: leave at a piece's exit, walk the edge clockwise to the next entry
    rings, used = [], [False] * len(pieces)
    for start in range(len(pieces)):
        if used[start]:
            continue
        ring, i = [], start
        while True:
            used[i] = True
            ring += pieces[i]
            t_exit = t_of(pieces[i][-1])
            nxt = min(range(len(pieces)), key=lambda j: (t_of(pieces[j][0]) - t_exit) % PERIM)
            t_entry = t_of(pieces[nxt][0])
            span = (t_entry - t_exit) % PERIM
            for t, c in sorted(corners, key=lambda tc: (tc[0] - t_exit) % PERIM):
                if 0 < (t - t_exit) % PERIM < span:
                    ring.append(c)
            if nxt == start or used[nxt]:
                break
            i = nxt
        rings.append(ring)

    to_int = lambda r: [[round(x), round(y)] for x, y in r]
    data = {
        'source': 'OpenStreetMap contributors (ODbL)',
        'rings': [to_int(r) for r in rings + islands],
        'coast': [to_int(c) for c in coast],
    }
    with open(out, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f'wrote {len(rings)} sea areas, {len(islands)} islands, {len(coast)} coast lines -> {out}')
    for r in rings:
        print(f'  sea area {area(r) / 1e6:.2f} km^2')


def main(kind, src, out):
    if kind == 'sea':
        return build_sea(json.load(open(src))['elements'], out)
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
