import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isJunction, routeOptions, stationsById } from '../data/greenLine';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';
import { PixelButton, ui } from './ui';

const ARROWS = { up: '▲', left: '◀', right: '▶', down: '▼' };

function NeighborCell({ dir, ids, onSelect }) {
  return (
    <View style={[styles.cell, (dir === 'up' || dir === 'down') && styles.cellCenter]}>
      <Text style={[styles.arrow, ids.length === 0 && styles.dim]}>{ARROWS[dir]}</Text>
      {ids.length === 0 ? (
        <Text style={[styles.body, styles.dim]}>---</Text>
      ) : (
        ids.map((id) => (
          <PixelButton key={id} onPress={() => onSelect(id)} style={styles.neighbor}>
            <Text style={styles.body} numberOfLines={1}>
              {stationsById[id].name}
            </Text>
          </PixelButton>
        ))
      )}
    </View>
  );
}

/**
 * At a junction the choices are signs on the map. This panel explains the sign
 * the rider tapped: which trains go that way, the next stop, and where they end up.
 */
function JunctionInfo({ station, previousId, activeSignId, onSelect }) {
  const option = activeSignId ? routeOptions(station.id).find((o) => o.id === activeSignId) : null;
  if (!option) {
    return (
      <View style={styles.junction}>
        <Text style={styles.prompt}>THE LINE SPLITS!</Text>
        <Text style={styles.hint}>Tap a sign on the map to see where it goes. Tap it again to ride.</Text>
      </View>
    );
  }
  const isBack = option.id === previousId;
  const trains = option.branches.length === 1 ? `${option.branches[0]} TRAIN` : `${option.branches.join(' · ')} TRAINS`;
  return (
    <View style={styles.junction}>
      <View style={styles.infoRow}>
        <View style={styles.optionBranches}>
          {option.branches.map((b) => (
            <View key={b} style={styles.branchTile}>
              <Text style={styles.branchTileText}>{b}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.prompt}>{isBack ? `BACK · ${trains}` : trains}</Text>
          <Text style={styles.infoText} numberOfLines={1}>
            Next stop: {stationsById[option.id].name}
          </Text>
          <Text style={styles.infoText} numberOfLines={1}>
            Toward {option.toward.join(' / ')}
          </Text>
        </View>
        <PixelButton onPress={() => onSelect(option.id)} style={styles.go}>
          <Text style={styles.goText}>GO ▶</Text>
        </PixelButton>
      </View>
      <Text style={styles.hint}>Tap the gold sign again to ride.</Text>
    </View>
  );
}

/** Game dialog box with a station's data: line, name, order on each branch, and where you can go next. */
export default function StationCard({ station, previousId, activeSignId, onSelect, onClose, onLayout }) {
  return (
    <View style={[ui.panel, styles.frame]} onLayout={onLayout}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>T</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{station.name.toUpperCase()}</Text>
          <Text style={styles.sub}>
            {station.line} Line{station.terminus ? ' · end of line' : ''}
            {station.transfers.length ? ` · ★ transfer: ${station.transfers.join(', ')}` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>X</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {station.branches.map((b) => (
          <View key={b} style={styles.chip}>
            <Text style={styles.chipText}>
              {b}-{String(station.order[b]).padStart(2, '0')}
            </Text>
          </View>
        ))}
      </View>

      {isJunction(station.id) ? (
        <JunctionInfo station={station} previousId={previousId} activeSignId={activeSignId} onSelect={onSelect} />
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
  frame: { position: 'absolute', left: 12, right: 12, bottom: 16, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 30,
    height: 30,
    borderWidth: 3,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.ink },
  name: { fontFamily: FONT_TITLE, fontSize: 12, lineHeight: 18, color: PALETTE.white },
  sub: { fontFamily: FONT_BODY, fontSize: 18, color: '#b7c0d8' },
  close: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.white, padding: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: PALETTE.green, borderWidth: 2, borderColor: PALETTE.greenLight, paddingHorizontal: 6, paddingVertical: 4 },
  chipText: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.white },
  body: { fontFamily: FONT_BODY, fontSize: 19, color: PALETTE.ink },
  dim: { color: '#6b7393' },

  pad: { marginTop: 12, gap: 6 },
  middleRow: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cellCenter: { justifyContent: 'center' },
  arrow: { fontSize: 14, color: PALETTE.gold, width: 16, textAlign: 'center' },
  neighbor: { paddingHorizontal: 6, paddingVertical: 1, flexShrink: 1 },

  junction: { marginTop: 12, gap: 8 },
  hint: { fontFamily: FONT_BODY, fontSize: 18, color: '#b7c0d8' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontFamily: FONT_BODY, fontSize: 18, color: PALETTE.white },
  go: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: PALETTE.green },
  goText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },
  prompt: { fontFamily: FONT_TITLE, fontSize: 8, lineHeight: 12, color: PALETTE.gold, marginBottom: 2 },
  optionBranches: { flexDirection: 'row', gap: 3, minWidth: 24 },
  branchTile: {
    width: 22,
    height: 22,
    backgroundColor: PALETTE.green,
    borderWidth: 2,
    borderColor: PALETTE.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchTileText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },
});
