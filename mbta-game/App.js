import { StatusBar } from 'expo-status-bar';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import StationCard from './src/components/StationCard';
import TransitMap from './src/components/TransitMap';
import { stationsById } from './src/data/greenLine';
import { FONT_BODY, FONT_TITLE, PALETTE } from './src/theme/pixel';

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular, VT323_400Regular });
  const mapRef = useRef(null);
  // The rider's position: the stop they're at, and the stop they just came from.
  const [trip, setTrip] = useState({ currentId: null, previousId: null });
  const selectedId = trip.currentId;
  const selected = selectedId ? stationsById[selectedId] : null;

  // Tapping a stop on the map drops the rider there (no previous stop yet).
  const placeAt = useCallback((id) => {
    setTrip({ currentId: id, previousId: null });
    if (id) mapRef.current?.focusStation(stationsById[id]);
  }, []);

  // Riding to a connected stop from the card remembers where we came from and follows the rider.
  const rideTo = useCallback((id) => {
    setTrip((t) => ({ currentId: id, previousId: t.currentId }));
    mapRef.current?.focusStation(stationsById[id]);
  }, []);

  if (!fontsLoaded) return <View style={styles.page} />;

  return (
    <View style={styles.page}>
      <View style={styles.phone}>
        <TransitMap ref={mapRef} selectedId={selectedId} onSelectStation={placeAt} />

        <View style={styles.header} pointerEvents="none">
          <View style={styles.lineBadge}>
            <Text style={styles.lineBadgeText}>GL</Text>
          </View>
          <Text style={styles.title}>GREEN LINE</Text>
        </View>

        <View style={styles.zoom}>
          <ZoomButton label="+" onPress={() => mapRef.current?.zoomIn()} />
          <ZoomButton label="-" onPress={() => mapRef.current?.zoomOut()} />
          <ZoomButton label="[]" onPress={() => mapRef.current?.reset()} />
        </View>

        {!selected && <StartHint />}

        {selected && (
          <StationCard
            station={selected}
            previousId={trip.previousId}
            onSelect={rideTo}
            onClose={() => placeAt(null)}
          />
        )}
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

function ZoomButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.zoomBtn, pressed ? styles.zoomBtnPressed : styles.zoomBtnUp]}>
      <Text style={styles.zoomText}>{label}</Text>
    </Pressable>
  );
}

/** Blinking "press start" prompt shown until the rider picks a stop. */
function StartHint() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 600);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.hint} pointerEvents="none">
      <Text style={[styles.hintText, !on && { opacity: 0 }]}>▶ TAP A STOP TO START</Text>
      <Text style={styles.hintSub}>pinch or scroll to zoom · drag to pan</Text>
    </View>
  );
}

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  // On the web, show the app inside a phone-sized frame; on devices it fills the screen.
  page: {
    flex: 1,
    backgroundColor: isWeb ? '#14141f' : PALETTE.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: isWeb
    ? { width: 390, height: 844, maxHeight: '100%', borderRadius: 28, overflow: 'hidden', borderWidth: 8, borderColor: '#000' }
    : { flex: 1, alignSelf: 'stretch' },
  header: {
    position: 'absolute',
    top: isWeb ? 16 : 56,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.night,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    boxShadow: `4px 4px 0px ${PALETTE.ink}`,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
  },
  lineBadge: {
    backgroundColor: PALETTE.green,
    borderWidth: 2,
    borderColor: PALETTE.greenLight,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBadgeText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },
  title: { fontFamily: FONT_TITLE, fontSize: 11, color: PALETTE.white },
  zoom: { position: 'absolute', right: 16, top: isWeb ? 16 : 56, gap: 10 },
  zoomBtn: {
    width: 40,
    height: 40,
    backgroundColor: PALETTE.white,
    borderWidth: 3,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnUp: { boxShadow: `3px 3px 0px ${PALETTE.ink}` },
  zoomBtnPressed: { transform: [{ translateX: 3 }, { translateY: 3 }], backgroundColor: PALETTE.gold },
  zoomText: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.ink },
  hint: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    alignItems: 'center',
    backgroundColor: PALETTE.night,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    boxShadow: `4px 4px 0px ${PALETTE.ink}`,
    paddingVertical: 10,
  },
  hintText: { fontFamily: FONT_TITLE, fontSize: 10, color: PALETTE.gold },
  hintSub: { fontFamily: FONT_BODY, fontSize: 17, color: '#b7c0d8', marginTop: 4 },
});
