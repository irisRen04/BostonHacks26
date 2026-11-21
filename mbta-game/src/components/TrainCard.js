import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';
import { PixelButton, ui } from './ui';

const STATUS_TEXT = {
  STOPPED_AT: 'Stopped at',
  INCOMING_AT: 'Arriving at',
  IN_TRANSIT_TO: 'On the way to',
};

function useSecondsAgo(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)) : null;
}

/** Dialog box for a live train: branch, destination, where it is, and a shortcut to that stop. */
export default function TrainCard({ train, onGoToStop, onClose, onLayout }) {
  const ago = useSecondsAgo(train.updatedAt);
  const { stopId } = train;
  return (
    <View style={[ui.panel, styles.frame]} onLayout={onLayout}>
      <View style={styles.header}>
        <View style={styles.tile}>
          <Text style={styles.tileText}>{train.branch}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>● LIVE TRAIN</Text>
          <Text style={styles.name}>{train.branch} TRAIN</Text>
          {!!train.headsign && <Text style={styles.sub}>to {train.headsign}</Text>}
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
          <Text style={styles.close}>X</Text>
        </Pressable>
      </View>

      {!!train.stopName && (
        <Text style={styles.status}>
          {STATUS_TEXT[train.status] ?? 'Near'} <Text style={styles.stop}>{train.stopName}</Text>
        </Text>
      )}
      <Text style={styles.meta}>
        Car {train.label}
        {ago != null ? ` · updated ${ago}s ago` : ''}
      </Text>

      {stopId && (
        <PixelButton onPress={() => onGoToStop(stopId)} style={styles.go}>
          <Text style={styles.goText}>GO TO {train.stopName.toUpperCase()} ▶</Text>
        </PixelButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 12, right: 12, bottom: 16, padding: 12, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: {
    width: 36,
    height: 36,
    backgroundColor: PALETTE.green,
    borderWidth: 3,
    borderColor: PALETTE.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { fontFamily: FONT_TITLE, fontSize: 14, color: PALETTE.white },
  kicker: { fontFamily: FONT_TITLE, fontSize: 8, color: '#ff5d5d', marginBottom: 4 },
  name: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.white },
  sub: { fontFamily: FONT_BODY, fontSize: 18, color: '#b7c0d8', marginTop: 2 },
  close: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.white, padding: 4 },
  status: { fontFamily: FONT_BODY, fontSize: 20, color: '#e3e7f3', marginTop: 6 },
  stop: { color: PALETTE.gold },
  meta: { fontFamily: FONT_BODY, fontSize: 16, color: '#8f98b5' },
  go: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: PALETTE.green, marginTop: 4 },
  goText: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.white },
});
