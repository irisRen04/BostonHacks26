import { StyleSheet, Text, View } from 'react-native';

import { useArrivals } from '../live/mbta';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';

/** Arrivals board for a stop: the next few Green Line trains and how many minutes away they are. */
export default function NextTrains({ stationId }) {
  const { arrivals, status } = useArrivals(stationId);
  return (
    <View style={styles.board}>
      <Text style={styles.title}>NEXT TRAINS</Text>
      {status === 'loading' && <Text style={styles.dim}>Checking the MBTA…</Text>}
      {(status === 'error' || status === 'rate-limited') && (
        <Text style={styles.dim}>{status === 'rate-limited' ? 'Too many requests, retrying soon' : 'Live times unavailable'}</Text>
      )}
      {status === 'live' && arrivals.length === 0 && <Text style={styles.dim}>No trains predicted right now</Text>}
      {arrivals.map((a) => (
        <View key={a.id} style={styles.row}>
          <View style={styles.tile}>
            <Text style={styles.tileText}>{a.branch}</Text>
          </View>
          <Text style={styles.headsign} numberOfLines={1}>
            {a.headsign}
          </Text>
          <Text style={styles.minutes}>{a.minutes <= 0 ? 'NOW' : `${a.minutes} MIN`}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { marginTop: 10, backgroundColor: '#11131f', borderWidth: 2, borderColor: '#4a5276', padding: 8, gap: 4 },
  title: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.gold, marginBottom: 2 },
  dim: { fontFamily: FONT_BODY, fontSize: 17, color: '#8f98b5' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { width: 16, height: 16, backgroundColor: PALETTE.green, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.white },
  headsign: { flex: 1, fontFamily: FONT_BODY, fontSize: 18, color: '#ffb347' },
  minutes: { fontFamily: FONT_TITLE, fontSize: 8, color: '#ffb347' },
});
