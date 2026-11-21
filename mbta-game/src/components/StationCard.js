import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LINE_COLORS, isJunction, routeOptions, stationsById } from '../data/greenLine';

const ARROWS = { up: '↑', left: '←', right: '→', down: '↓' };

function NeighborCell({ dir, ids, onSelect }) {
  return (
    <View style={[styles.cell, styles[`cell_${dir}`]]}>
      <Text style={styles.arrow}>{ARROWS[dir]}</Text>
      {ids.length === 0 ? (
        <Text style={styles.none}>—</Text>
      ) : (
        ids.map((id) => (
          <Pressable key={id} onPress={() => onSelect(id)} style={styles.neighbor}>
            <Text style={styles.neighborText} numberOfLines={1}>
              {stationsById[id].name}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

/**
 * At a junction the rider picks a branch instead of an arrow. The stop they came from
 * is split out as a separate "back" button; every other connection is a choice.
 */
function JunctionChoices({ station, previousId, onSelect }) {
  const options = routeOptions(station.id);
  const back = options.find((o) => o.id === previousId);
  const forward = options.filter((o) => o.id !== previousId);
  return (
    <View style={styles.junction}>
      <Text style={styles.junctionPrompt}>The line splits here. Where to?</Text>
      {forward.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onSelect(o.id)}
          style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        >
          <View style={styles.optionBranches}>
            {o.branches.map((b) => (
              <View key={b} style={styles.branchDot}>
                <Text style={styles.branchDotText}>{b}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionName} numberOfLines={1}>
              {stationsById[o.id].name}
            </Text>
            <Text style={styles.optionToward} numberOfLines={1}>
              toward {o.toward.join(' / ')}
            </Text>
          </View>
          <Text style={styles.optionChevron}>›</Text>
        </Pressable>
      ))}
      {back && (
        <Pressable
          onPress={() => onSelect(back.id)}
          style={({ pressed }) => [styles.backButton, pressed && styles.optionPressed]}
        >
          <Text style={styles.backText} numberOfLines={1}>
            ↩ Back to {stationsById[back.id].name}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Bottom sheet with a station's data: line, name, order on each branch, and left/right/up/down neighbours. */
export default function StationCard({ station, previousId, onSelect, onClose }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>T</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{station.name}</Text>
          <Text style={styles.sub}>
            {station.line} Line{station.terminus ? ' · Terminus' : ''}
            {station.transfers.length ? ` · Transfer: ${station.transfers.join(', ')}` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {station.branches.map((b) => (
          <View key={b} style={styles.chip}>
            <Text style={styles.chipText}>
              {b} · stop {station.order[b]}
            </Text>
          </View>
        ))}
      </View>

      {isJunction(station.id) ? (
        <JunctionChoices station={station} previousId={previousId} onSelect={onSelect} />
      ) : (
        <View style={styles.pad}>
          <NeighborCell dir="up" ids={station.up} onSelect={onSelect} />
          <View style={styles.middleRow}>
            <NeighborCell dir="left" ids={station.left} onSelect={onSelect} />
            <NeighborCell dir="right" ids={station.right} onSelect={onSelect} />
          </View>
          <NeighborCell dir="down" ids={station.down} onSelect={onSelect} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#1c1c1c',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  badgeText: { fontWeight: '900', fontSize: 17, color: '#1c1c1c' },
  name: { fontSize: 19, fontWeight: '800', color: '#1c1c1c' },
  sub: { fontSize: 12, color: '#555', marginTop: 2 },
  close: { fontSize: 18, color: '#777', paddingHorizontal: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: LINE_COLORS.Green, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  pad: { marginTop: 12, gap: 6 },
  middleRow: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F5F3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cell_up: { alignSelf: 'center', minWidth: '60%' },
  cell_down: { alignSelf: 'center', minWidth: '60%' },
  arrow: { fontSize: 16, fontWeight: '900', color: LINE_COLORS.Green, width: 16 },
  none: { color: '#aaa' },
  neighbor: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#d6e3da', flexShrink: 1 },
  junction: { marginTop: 12, gap: 6 },
  junctionPrompt: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F2F5F3',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d6e3da',
  },
  optionPressed: { opacity: 0.6 },
  optionBranches: { flexDirection: 'row', gap: 3, minWidth: 26 },
  branchDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LINE_COLORS.Green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchDotText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  optionName: { fontSize: 15, fontWeight: '700', color: '#1c1c1c' },
  optionToward: { fontSize: 12, color: '#666', marginTop: 1 },
  optionChevron: { fontSize: 22, color: LINE_COLORS.Green, fontWeight: '700' },
  backButton: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: '#bbb',
    borderStyle: 'dashed',
    marginTop: 2,
  },
  backText: { fontSize: 14, fontWeight: '700', color: '#444' },
  neighborText: { fontSize: 12, fontWeight: '600', color: '#1c1c1c' },
});
