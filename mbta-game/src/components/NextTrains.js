import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';

/**
 * Arrivals board for a stop: the next few Green Line trains and how many minutes
 * away they are. The train you're waiting for is marked; tap another row to wait for that one.
 */
export default function NextTrains({ arrivals, status, watchedId, onWatch }) {
  return (
    <View style={styles.board}>
      <Text style={styles.title}>NEXT TRAINS</Text>
      {status === 'loading' && <Text style={styles.dim}>Checking the MBTA…</Text>}
      {(status === 'error' || status === 'rate-limited') && (
        <Text style={styles.dim}>{status === 'rate-limited' ? 'Too many requests, retrying soon' : 'Live times unavailable'}</Text>
      )}
      {status === 'live' && arrivals.length === 0 && <Text style={styles.dim}>No trains predicted right now</Text>}
      {arrivals.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => onWatch(a.id)}
          style={[styles.row, a.id === watchedId && styles.watched]}
          accessibilityLabel={`Wait for the ${a.branch} train to ${a.headsign}`}
        >
          <Text style={styles.marker}>{a.id === watchedId ? '▶' : ' '}</Text>
          <View style={styles.tile}>
            <Text style={styles.tileText}>{a.branch}</Text>
          </View>
          <Text style={styles.headsign} numberOfLines={1}>
            {a.headsign}
          </Text>
          <Text style={styles.minutes}>{a.minutes <= 0 ? 'NOW' : `${a.minutes} MIN`}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { marginTop: 10, backgroundColor: '#11131f', borderWidth: 2, borderColor: '#4a5276', padding: 8, gap: 4 },
  title: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.gold, marginBottom: 2 },
  dim: { fontFamily: FONT_BODY, fontSize: 17, color: '#8f98b5' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 1, paddingRight: 4, borderWidth: 1, borderColor: 'transparent' },
  watched: { borderColor: PALETTE.gold, backgroundColor: '#2a2410' },
  marker: { width: 10, fontSize: 9, color: PALETTE.gold },
  tile: { width: 16, height: 16, backgroundColor: PALETTE.green, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.white },
  headsign: { flex: 1, fontFamily: FONT_BODY, fontSize: 18, color: '#ffb347' },
  minutes: { fontFamily: FONT_TITLE, fontSize: 8, color: '#ffb347' },
});
