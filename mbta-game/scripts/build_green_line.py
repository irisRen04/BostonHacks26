"""
Builds src/data/greenLine.json from the MBTA ArcGIS rapid-transit shapefiles
(MBTA_NODE = stations, MBTA_ARC = track geometry).

    python3 scripts/build_green_line.py /path/to/unzipped/mbta_rapid_transit

Coordinates stay in the source projection (NAD83 Massachusetts State Plane,
meters), which is conformal, so we can draw them directly as x/y.

Directional neighbours (left/right/up/down) follow the schematic orientation
used by the game, anchored at Kenmore:
    C branch -> left, B branch -> up, D branch -> down, toward downtown -> right.
Each edge has one direction; the reverse edge gets the opposite direction.
"""
import json
import os
import struct
import sys

# ---------------------------------------------------------------- shapefile io

def read_dbf(path):
    with open(path, 'rb') as f:
        data = f.read()
    nrec, hlen, rlen = struct.unpack('<IHH', data[4:12])
    fields, off = [], 32
    while data[off] != 0x0D:
        name = data[off:off + 11].split(b'\0')[0].decode()
        fields.append((name, data[off + 16]))
        off += 32
    recs = []
    for i in range(nrec):
        p = hlen + i * rlen + 1
        rec = {}
        for name, flen in fields:
            rec[name] = data[p:p + flen].decode('latin-1').strip()
            p += flen
        recs.append(rec)
    return recs


def read_shp(path):
    with open(path, 'rb') as f:
        data = f.read()
    off, shapes = 100, []
    while off < len(data):
        clen = struct.unpack('>I', data[off + 4:off + 8])[0]
        c = data[off + 8:off + 8 + clen * 2]
        off += 8 + clen * 2
        stype = struct.unpack('<i', c[:4])[0]
        if stype == 1:
            shapes.append(list(struct.unpack('<dd', c[4:20])))
        elif stype in (3, 13, 23):
            nparts, npts = struct.unpack('<ii', c[36:44])
            parts = list(struct.unpack('<%di' % nparts, c[44:44 + 4 * nparts])) + [npts]
            s = 44 + 4 * nparts
            pts = [struct.unpack('<dd', c[s + 16 * i:s + 16 * i + 16]) for i in range(npts)]
            shapes.append([pts[parts[i]:parts[i + 1]] for i in range(nparts)])
        else:
            shapes.append(None)
    return shapes


def load(d, name):
    return list(zip(read_dbf(os.path.join(d, name + '.dbf')), read_shp(os.path.join(d, name + '.shp'))))

# ---------------------------------------------------------------- line model

# Each branch listed from its outer terminus inbound, so order 1 = terminus.
BRANCHES = {
    'B': ['Boston College', 'South Street', 'Chestnut Hill Avenue', 'Chiswick Road', 'Sutherland Road',
          'Washington Street', 'Warren Street', 'Allston Street', 'Griggs Street', 'Harvard Avenue',
          'Packards Corner', 'Babcock Street', 'Amory Street', 'Boston University Central',
          'Boston University East', 'Blandford Street', 'Kenmore', 'Hynes Convention Center', 'Copley',
          'Arlington', 'Boylston', 'Park Street', 'Government Center'],
    'C': ['Cleveland Circle', 'Englewood Avenue', 'Dean Road', 'Tappan Street', 'Washington Square',
          'Fairbanks Street', 'Brandon Hall', 'Summit Avenue', 'Coolidge Corner', 'Saint Paul Street',
          'Kent Street', 'Hawes Street', 'Saint Marys Street', 'Kenmore', 'Hynes Convention Center', 'Copley',
          'Arlington', 'Boylston', 'Park Street', 'Government Center'],
    'D': ['Riverside', 'Woodland', 'Waban', 'Eliot', 'Newton Highlands', 'Newton Centre', 'Chestnut Hill',
          'Reservoir', 'Beaconsfield', 'Brookline Hills', 'Brookline Village', 'Longwood', 'Fenway', 'Kenmore',
          'Hynes Convention Center', 'Copley', 'Arlington', 'Boylston', 'Park Street', 'Government Center',
          'Haymarket', 'North Station', 'Science Park/West End', 'Lechmere', 'Union Square'],
    'E': ['Heath Street', 'Back Of The Hill', 'Riverway', 'Mission Park', 'Fenwood Road', 'Brigham Circle',
          'Longwood Medical Area', 'Museum Of Fine Arts', 'Northeastern', 'Symphony', 'Prudential', 'Copley',
          'Arlington', 'Boylston', 'Park Street', 'Government Center', 'Haymarket', 'North Station',
          'Science Park/West End', 'Lechmere', 'East Somerville', 'Gilman Square', 'Magoun Square',
          'Ball Square', 'Medford/Tufts'],
}

OPPOSITE = {'left': 'right', 'right': 'left', 'up': 'down', 'down': 'up'}


def edge_direction(a, b):
    """Schematic direction of travelling from station a to adjacent station b."""
    special = {
        ('Kenmore', 'Saint Marys Street'): 'left',     # C
        ('Kenmore', 'Blandford Street'): 'up',         # B
        ('Kenmore', 'Fenway'): 'down',                 # D
        ('Copley', 'Prudential'): 'down',              # E splits off the trunk
        ('Park Street', 'Government Center'): 'up',    # trunk turns north downtown
        ('Lechmere', 'Union Square'): 'left',          # D (Union Sq) splits from E
    }
    if (a, b) in special:
        return special[(a, b)]
    if (b, a) in special:
        return OPPOSITE[special[(b, a)]]
    return None


NORTH_OF_PARK = {'Government Center', 'Haymarket', 'North Station', 'Science Park/West End', 'Lechmere',
                 'East Somerville', 'Gilman Square', 'Magoun Square', 'Ball Square', 'Medford/Tufts'}
E_SOUTH = set(BRANCHES['E'][:BRANCHES['E'].index('Prudential') + 1])


def direction(a, b, inbound):
    d = edge_direction(a, b)
    if d:
        return d
    if a in NORTH_OF_PARK and b in NORTH_OF_PARK:            # Gov Ctr -> Medford runs up the map
        return 'up' if inbound else 'down'
    if a in E_SOUTH and b in E_SOUTH:                         # Heath St -> Prudential runs up toward Copley
        return 'up' if inbound else 'down'
    return 'right' if inbound else 'left'                    # B/C/D branches + trunk run left/right


def slug(name):
    return ''.join(ch if ch.isalnum() else '-' for ch in name.lower()).strip('-').replace('--', '-')


def main(src, out):
    nodes = load(src, 'MBTA_NODE')
    arcs = load(src, 'MBTA_ARC')

    coords = {}
    meta = {}
    for rec, xy in nodes:
        if 'GREEN' in rec['LINE']:
            coords[rec['STATION']] = [round(xy[0]), round(xy[1])]
            meta[rec['STATION']] = rec

    stations = {}
    for branch, seq in BRANCHES.items():
        for i, name in enumerate(seq):
            if name not in coords:
                raise SystemExit(f'{name} missing from MBTA_NODE')
            s = stations.setdefault(name, {
                'id': slug(name),
                'name': name,
                'line': 'Green',
                'branches': [],
                'order': {},
                'x': coords[name][0],
                'y': coords[name][1],
                'terminus': meta[name]['TERMINUS'] == 'Y',
                'transfers': [l.title() for l in meta[name]['LINE'].split('/') if l != 'GREEN'],
                'left': [], 'right': [], 'up': [], 'down': [],
            })
            s['branches'].append(branch)
            s['order'][branch] = i + 1
            for j, inbound in ((i - 1, False), (i + 1, True)):
                if 0 <= j < len(seq):
                    other = seq[j]
                    d = direction(name, other, inbound)
                    oid = slug(other)
                    if oid not in s[d]:
                        s[d].append(oid)

    # sanity: every edge must be reciprocal
    by_id = {s['id']: s for s in stations.values()}
    for s in by_id.values():
        for d in ('left', 'right', 'up', 'down'):
            for n in s[d]:
                assert s['id'] in by_id[n][OPPOSITE[d]], (s['name'], d, n)

    def simplify(pts):
        out_pts, last = [], None
        for x, y in pts:
            p = [round(x), round(y)]
            if last is None or abs(p[0] - last[0]) + abs(p[1] - last[1]) >= 8:
                out_pts.append(p)
                last = p
        if out_pts[-1] != [round(pts[-1][0]), round(pts[-1][1])]:
            out_pts.append([round(pts[-1][0]), round(pts[-1][1])])
        return out_pts

    tracks = []
    for rec, parts in arcs:
        for part in parts or []:
            tracks.append({'line': rec['LINE'].title(), 'route': rec['ROUTE'], 'points': simplify(part)})

    green = list(stations.values())
    xs = [s['x'] for s in green]
    ys = [s['y'] for s in green]
    data = {
        'source': 'MBTA ArcGIS rapid transit (MBTA_NODE / MBTA_ARC), NAD83 MA State Plane meters',
        'bounds': {'minX': min(xs), 'maxX': max(xs), 'minY': min(ys), 'maxY': max(ys)},
        'branches': {b: [slug(n) for n in seq] for b, seq in BRANCHES.items()},
        'stations': sorted(green, key=lambda s: s['id']),
        'tracks': tracks,
    }
    with open(out, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f'wrote {len(green)} green line stations, {len(tracks)} track segments -> {out}')


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    main(sys.argv[1], os.path.join(here, '..', 'src', 'data', 'greenLine.json'))
