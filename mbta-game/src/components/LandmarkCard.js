import { Pressable, StyleSheet, Text, View } from 'react-native';

import { stationsById } from '../data/greenLine';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';
import LandmarkSprite from './LandmarkSprite';
import { PixelButton, ui } from './ui';

/**
 * Dialog box for a landmark. Undiscovered landmarks keep their details hidden
 * and only tell you which stop to ride to.
 */
export default function LandmarkCard({ landmark, discovered, atNearestStop, onGo, onClose, onLayout }) {
  const stop = stationsById[landmark.nearestStop];
  return (
    <View style={[ui.panel, styles.frame]} onLayout={onLayout}>
      <View style={styles.header}>
        <View style={styles.thumb}>
          <LandmarkSprite landmark={landmark} px={2} discovered={discovered} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{discovered ? '★ LANDMARK' : '? UNDISCOVERED'}</Text>
          <Text style={styles.name}>{discovered ? landmark.name.toUpperCase() : '???'}</Text>
          {discovered && (
            <Text style={styles.sub}>
              {landmark.owner} · {landmark.address}
            </Text>
          )}
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
          <Text style={styles.close}>X</Text>
        </Pressable>
      </View>

      {discovered ? (
        <View style={styles.body}>
          <Text style={styles.text}>{landmark.blurb}</Text>
          <Text style={styles.fact}>FUN FACT: {landmark.fact}</Text>
        </View>
      ) : (
        <Text style={[styles.text, styles.body]}>Something's over here... Ride to {stop.name} to discover it!</Text>
      )}

      <View style={styles.footer}>
        <Text style={styles.near} numberOfLines={1}>
          Nearest stop: {stop.name}
        </Text>
        {!atNearestStop && (
          <PixelButton onPress={onGo} style={styles.go}>
            <Text style={styles.goText}>GO THERE ▶</Text>
          </PixelButton>
        )}
      </View>
    </View>
  );
}

/** Celebration shown the first time a rider reaches a landmark's stop. */
export function DiscoveryPopup({ landmark, onClose }) {
  return (
    <View style={styles.popupBackdrop}>
      <View style={[ui.panel, styles.popup]}>
        <Text style={styles.popupTitle}>DISCOVERED!</Text>
        <View style={styles.popupArt}>
          <LandmarkSprite landmark={landmark} px={5} />
        </View>
        <Text style={styles.popupName}>{landmark.name.toUpperCase()}</Text>
        <Text style={styles.text}>Added to Places to visit.</Text>
        <PixelButton onPress={onClose} style={styles.ok}>
          <Text style={styles.goText}>OK</Text>
        </PixelButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 12, right: 12, bottom: 16, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { backgroundColor: PALETTE.ground, borderWidth: 3, borderColor: PALETTE.ink, padding: 4 },
  kicker: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.gold, marginBottom: 4 },
  name: { fontFamily: FONT_TITLE, fontSize: 10, lineHeight: 15, color: PALETTE.white },
  sub: { fontFamily: FONT_BODY, fontSize: 17, color: '#b7c0d8', marginTop: 2 },
  close: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.white, padding: 4 },
  body: { marginTop: 10, gap: 6 },
  text: { fontFamily: FONT_BODY, fontSize: 19, lineHeight: 20, color: '#e3e7f3' },
  fact: { fontFamily: FONT_BODY, fontSize: 18, lineHeight: 19, color: PALETTE.gold },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  near: { flex: 1, fontFamily: FONT_BODY, fontSize: 17, color: '#b7c0d8' },
  go: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: PALETTE.green },
  goText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },

  popupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,20,31,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  popup: { alignItems: 'center', padding: 16, gap: 10, alignSelf: 'stretch' },
  popupTitle: { fontFamily: FONT_TITLE, fontSize: 16, color: PALETTE.gold },
  popupArt: { backgroundColor: PALETTE.ground, borderWidth: 3, borderColor: PALETTE.ink, paddingHorizontal: 24, paddingVertical: 10 },
  popupName: { fontFamily: FONT_TITLE, fontSize: 10, lineHeight: 15, color: PALETTE.white, textAlign: 'center' },
  ok: { paddingHorizontal: 28, paddingVertical: 10, backgroundColor: PALETTE.green, marginTop: 4 },
});
