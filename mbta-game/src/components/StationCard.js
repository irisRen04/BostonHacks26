import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { isJunction, routeOptions, stationsById } from '../data/greenLine';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';
import NextTrains from './NextTrains';
import { PixelButton, ui } from './ui';

/**
 * Arrow pointing the way the next stop lies on the map (snapped to 8 directions),
 * so it always matches what you see on screen.
 */
function MapArrow({ fromId, toId }) {
  const a = stationsById[fromId];
  const b = stationsById[toId];
  // map y grows north, screen rotation is clockwise from "pointing right"
  const deg = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
  const snapped = Math.round(deg / 45) * 45;
  return (
    <View style={styles.arrowTile}>
      <Text style={[styles.arrowGlyph, { transform: [{ rotate: `${snapped}deg` }] }]}>➜</Text>
    </View>
  );
}

function BranchTiles({ branches, small }) {
  return (
    <View style={styles.optionBranches}>
      {branches.map((b) => (
        <View key={b} style={[styles.branchTile, small && styles.branchTileSmall]}>
          <Text style={[styles.branchTileText, small && styles.branchTileTextSmall]}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

/** A way to ride from an ordinary stop: the next stop and where those trains end up. */
function NextStopButton({ fromId, option, onSelect, compact }) {
  return (
    <PixelButton onPress={() => onSelect(option.id)} style={[styles.next, compact && styles.nextCompact]}>
      <MapArrow fromId={fromId} toId={option.id} />
      <BranchTiles branches={option.branches} small />
      <View style={{ flex: 1 }}>
        <Text style={styles.nextName} numberOfLines={1}>
          {stationsById[option.id].name}
        </Text>
        {!compact && (
          <Text style={styles.toward} numberOfLines={1}>
            toward {option.toward.join(' / ')}
          </Text>
        )}
      </View>
      <Text style={styles.nextGo}>▶</Text>
    </PixelButton>
  );
}

/**
 * When the next stop is a junction it gets a bigger banner that previews the
 * branches you can take once you get there (not counting the way back here).
 */
function JunctionBanner({ fromId, option, onSelect, compact }) {
  const ahead = routeOptions(option.id).filter((o) => o.id !== fromId);
  return (
    <PixelButton onPress={() => onSelect(option.id)} style={styles.banner}>
      <View style={styles.bannerHead}>
        <MapArrow fromId={fromId} toId={option.id} />
        <Text style={styles.bannerName} numberOfLines={1}>
          {stationsById[option.id].name.toUpperCase()}
        </Text>
        <View style={styles.junctionTag}>
          <Text style={styles.junctionTagText}>★ JUNCTION</Text>
        </View>
      </View>
      {compact ? null : <Text style={styles.bannerLead}>From there you can take:</Text>}
      {(compact ? [] : ahead).map((o) => (
        <View key={o.id} style={styles.bannerRow}>
          <BranchTiles branches={o.branches} small />
          <Text style={styles.bannerRowText} numberOfLines={1}>
            to {o.toward.join(' / ')}
          </Text>
        </View>
      ))}
      {compact ? null : <Text style={styles.bannerGo}>RIDE TO {stationsById[option.id].name.toUpperCase()} ▶</Text>}
    </PixelButton>
  );
}

/** Ordinary stop: one button per way you can go, labelled by destination instead of arrows. */
function NextStops({ station, onSelect, compact }) {
  const options = routeOptions(station.id);
  return (
    <View style={styles.nextList}>
      {options.map((o) =>
        isJunction(o.id) ? (
          <JunctionBanner key={o.id} fromId={station.id} option={o} onSelect={onSelect} compact={compact} />
        ) : (
          <NextStopButton key={o.id} fromId={station.id} option={o} onSelect={onSelect} compact={compact} />
        ),
      )}
      {options.length === 1 && !compact && <Text style={styles.hint}>End of the line. The only way is back.</Text>}
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
        <BranchTiles branches={option.branches} />
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
/**
 * Game dialog box for a stop. It opens as a short "peek" card (name, the next train and
 * compact ride buttons) so most of the map stays visible; tap or swipe up on the handle,
 * or press MORE, to expand it to every arrival and the full ride options.
 */
export default function StationCard({ station, previousId, activeSignId, arrivals, watchedId, onWatch, onSelect, onClose, onLayout }) {
  const [expanded, setExpanded] = useState(false);
  const junction = isJunction(station.id);
  const branchText = station.branches.map((b) => `${b}-${String(station.order[b]).padStart(2, '0')}`).join(' · ');

  // the handle: a tap toggles, a swipe up expands, a swipe down collapses
  const handle = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (e, g) => {
          if (g.dy < -20) setExpanded(true);
          else if (g.dy > 20) setExpanded(false);
          else if (Math.abs(g.dx) < 10) setExpanded((v) => !v);
        },
      }),
    [],
  );

  return (
    <View style={[ui.panel, styles.frame]} onLayout={onLayout}>
      <View {...handle.panHandlers} style={styles.handleArea} accessibilityRole="button" accessibilityLabel={expanded ? 'Show less' : 'Show more'}>
        <View style={styles.handle} />
      </View>

      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>T</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{station.name.toUpperCase()}</Text>
          <Text style={styles.sub} numberOfLines={expanded ? undefined : 1}>
            {expanded ? `${station.line} Line` : branchText}
            {station.terminus ? ' · end of line' : ''}
            {station.transfers.length ? ` · ★ ${expanded ? 'transfer: ' : ''}${station.transfers.join(', ')}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} style={styles.more}>
          <Text style={styles.moreText}>{expanded ? 'LESS ▼' : 'MORE ▲'}</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>X</Text>
        </Pressable>
      </View>

      {expanded && (
        <View style={styles.chips}>
          {station.branches.map((b) => (
            <View key={b} style={styles.chip}>
              <Text style={styles.chipText}>
                {b}-{String(station.order[b]).padStart(2, '0')}
              </Text>
            </View>
          ))}
        </View>
      )}

      <NextTrains
        arrivals={arrivals.arrivals}
        status={arrivals.status}
        watchedId={watchedId}
        onWatch={onWatch}
        limit={expanded ? undefined : 1}
      />

      {junction ? (
        <JunctionInfo station={station} previousId={previousId} activeSignId={activeSignId} onSelect={onSelect} />
      ) : (
        <NextStops station={station} onSelect={onSelect} compact={!expanded} />
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
  branchTileSmall: { width: 18, height: 18 },
  branchTileTextSmall: { fontSize: 8 },

  nextList: { marginTop: 10, gap: 6 },
  nextCompact: { paddingVertical: 4 },
  handleArea: { alignItems: 'center', paddingBottom: 6, marginTop: -4 },
  handle: { width: 40, height: 5, backgroundColor: '#6b7393' },
  more: { borderWidth: 2, borderColor: '#6b7393', paddingHorizontal: 5, paddingVertical: 3 },
  moreText: { fontFamily: FONT_TITLE, fontSize: 7, color: '#c9cfe0' },
  arrowTile: {
    width: 24,
    height: 24,
    backgroundColor: PALETTE.night,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: { fontSize: 14, lineHeight: 16, color: PALETTE.gold, fontWeight: '900' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  nextName: { fontFamily: FONT_TITLE, fontSize: 9, lineHeight: 14, color: PALETTE.ink },
  toward: { fontFamily: FONT_BODY, fontSize: 17, color: '#4a5068' },
  nextGo: { fontSize: 14, color: PALETTE.ink },

  banner: { padding: 10, gap: 4, backgroundColor: '#fff6d6', borderColor: PALETTE.ink },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerName: { flexShrink: 1, fontFamily: FONT_TITLE, fontSize: 12, lineHeight: 18, color: PALETTE.ink },
  junctionTag: { backgroundColor: PALETTE.gold, borderWidth: 2, borderColor: PALETTE.ink, paddingHorizontal: 5, paddingVertical: 3 },
  junctionTagText: { fontFamily: FONT_TITLE, fontSize: 7, color: PALETTE.ink },
  bannerLead: { fontFamily: FONT_BODY, fontSize: 17, color: '#4a5068' },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerRowText: { flex: 1, fontFamily: FONT_BODY, fontSize: 18, color: PALETTE.ink },
  bannerGo: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.green, marginTop: 4, alignSelf: 'flex-end' },
});
