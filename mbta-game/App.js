import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import StationCard from './src/components/StationCard';
import TransitMap from './src/components/TransitMap';
import { LINE_COLORS, stationsById } from './src/data/greenLine';

export default function App() {
  const mapRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const selected = selectedId ? stationsById[selectedId] : null;

  // Selecting from the card (a neighbour) also recentres the map on that stop.
  const goTo = useCallback((id) => {
    setSelectedId(id);
    mapRef.current?.focusStation(stationsById[id]);
  }, []);

  return (
    <View style={styles.page}>
      <View style={styles.phone}>
        <TransitMap ref={mapRef} selectedId={selectedId} onSelectStation={setSelectedId} />

        <View style={styles.header} pointerEvents="none">
          <View style={styles.lineBadge}>
            <Text style={styles.lineBadgeText}>GL</Text>
          </View>
          <Text style={styles.title}>Green Line</Text>
        </View>

        <View style={styles.zoom}>
          <ZoomButton label="+" onPress={() => mapRef.current?.zoomIn()} />
          <ZoomButton label="−" onPress={() => mapRef.current?.zoomOut()} />
          <ZoomButton label="⤢" onPress={() => mapRef.current?.reset()} />
        </View>

        {selected && <StationCard station={selected} onSelect={goTo} onClose={() => setSelectedId(null)} />}
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

function ZoomButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.zoomBtn, pressed && { opacity: 0.6 }]}>
      <Text style={styles.zoomText}>{label}</Text>
    </Pressable>
  );
}

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  // On the web, show the app inside a phone-sized frame; on devices it fills the screen.
  page: {
    flex: 1,
    backgroundColor: isWeb ? '#1f2421' : '#F4F1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: isWeb
    ? { width: 390, height: 844, maxHeight: '100%', borderRadius: 36, overflow: 'hidden', borderWidth: 8, borderColor: '#000' }
    : { flex: 1, alignSelf: 'stretch' },
  header: {
    position: 'absolute',
    top: isWeb ? 16 : 56,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
  },
  lineBadge: {
    backgroundColor: LINE_COLORS.Green,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  title: { fontWeight: '800', fontSize: 16, color: '#1c1c1c' },
  zoom: { position: 'absolute', right: 14, top: isWeb ? 16 : 56, gap: 8 },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  zoomText: { fontSize: 20, fontWeight: '700', color: '#1c1c1c' },
});
