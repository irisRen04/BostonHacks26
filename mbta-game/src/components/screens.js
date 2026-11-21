// Full-screen game panels opened from the corner menu.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AVATAR_OPTIONS, randomAvatar } from '../avatar/avatar';
import { stationsById } from '../data/greenLine';
import { landmarks } from '../data/landmarks';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';
import AvatarSprite from './AvatarSprite';
import LandmarkSprite from './LandmarkSprite';
import { PixelButton, ui } from './ui';

function GameScreen({ title, onClose, children, footer }) {
  return (
    <View style={styles.backdrop}>
      <View style={[ui.panel, styles.screen]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Text style={styles.close}>X</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
        {footer}
      </View>
    </View>
  );
}

/** Pick each avatar part with ◀ ▶. Changes are only kept when you press SAVE. */
export function CustomizeScreen({ avatar, onSave, onClose }) {
  const [draft, setDraft] = useState(avatar);

  const step = (key, choices, delta) => {
    const i = choices.findIndex((c) => c.id === draft[key]);
    const next = choices[(i + delta + choices.length) % choices.length];
    setDraft((d) => ({ ...d, [key]: next.id }));
  };

  return (
    <GameScreen
      title="CUSTOMIZE"
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <PixelButton onPress={() => setDraft(randomAvatar())} style={[styles.footerButton, styles.secondary]}>
            <Text style={styles.footerText}>? RANDOM</Text>
          </PixelButton>
          <PixelButton
            onPress={() => {
              onSave(draft);
              onClose();
            }}
            style={[styles.footerButton, styles.primary]}
          >
            <Text style={[styles.footerText, { color: PALETTE.white }]}>SAVE</Text>
          </PixelButton>
        </View>
      }
    >
      <View style={styles.preview}>
        <AvatarSprite avatar={draft} px={8} />
      </View>
      {AVATAR_OPTIONS.map(({ key, label, choices }) => {
        const current = choices.find((c) => c.id === draft[key]);
        return (
          <View key={key} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <PixelButton onPress={() => step(key, choices, -1)} style={styles.arrowButton} accessibilityLabel={`Previous ${label}`}>
              <Text style={styles.arrowText}>◀</Text>
            </PixelButton>
            <View style={styles.valueBox}>
              {current.color && <View style={[styles.swatch, { backgroundColor: current.color }]} />}
              <Text style={styles.value} numberOfLines={1}>
                {current.label}
              </Text>
            </View>
            <PixelButton onPress={() => step(key, choices, 1)} style={styles.arrowButton} accessibilityLabel={`Next ${label}`}>
              <Text style={styles.arrowText}>▶</Text>
            </PixelButton>
          </View>
        );
      })}
    </GameScreen>
  );
}

/** Landmark collection: discovered ones in colour, the rest as silhouettes. Tapping one shows it on the map. */
export function PlacesScreen({ discovered, onShow, onClose }) {
  const found = landmarks.filter((l) => discovered[l.id]).length;
  return (
    <GameScreen title="PLACES TO VISIT" onClose={onClose}>
      <Text style={styles.counter}>
        DISCOVERED {found}/{landmarks.length}
      </Text>
      {landmarks.map((lm) => {
        const known = !!discovered[lm.id];
        return (
          <PixelButton key={lm.id} onPress={() => onShow(lm.id)} style={styles.place}>
            <View style={styles.placeThumb}>
              <LandmarkSprite landmark={lm} px={2} discovered={known} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName} numberOfLines={2}>
                {known ? lm.name.toUpperCase() : '???'}
              </Text>
              <Text style={styles.placeNear} numberOfLines={1}>
                near {stationsById[lm.nearestStop].name}
              </Text>
            </View>
            <Text style={styles.placeGo}>▶</Text>
          </PixelButton>
        );
      })}
      <Text style={styles.placesHint}>Ride to a landmark's stop to discover it. More landmarks coming soon!</Text>
    </GameScreen>
  );
}

const COMING_SOON = {
  friends: {
    title: 'FRIENDS',
    icon: '☺',
    text: 'Add friends, see where their avatars are riding, and meet up at a stop.',
  },
  settings: {
    title: 'SETTINGS',
    icon: '⚙',
    text: 'Sound, map labels, and resetting your progress.',
  },
};

/** Placeholder for menu items that aren't built yet. */
export function ComingSoonScreen({ id, onClose }) {
  const info = COMING_SOON[id];
  return (
    <GameScreen title={info.title} onClose={onClose}>
      <View style={styles.soon}>
        <Text style={styles.soonIcon}>{info.icon}</Text>
        <Text style={styles.soonTitle}>COMING SOON</Text>
        <Text style={styles.soonText}>{info.text}</Text>
      </View>
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,20,31,0.55)',
    padding: 14,
    paddingTop: 70,
    justifyContent: 'flex-end',
  },
  screen: { maxHeight: '100%', padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: FONT_TITLE, fontSize: 13, color: PALETTE.white },
  close: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.white, padding: 4 },
  body: { gap: 8, paddingBottom: 4 },

  preview: {
    alignSelf: 'center',
    backgroundColor: PALETTE.ground,
    borderWidth: 3,
    borderColor: PALETTE.ink,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.gold, width: 84 },
  arrowButton: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 13, color: PALETTE.ink },
  valueBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    backgroundColor: '#1b1f33',
    borderWidth: 2,
    borderColor: '#4a5276',
  },
  swatch: { width: 12, height: 12, borderWidth: 2, borderColor: PALETTE.ink },
  value: { fontFamily: FONT_BODY, fontSize: 19, color: PALETTE.white },

  footer: { flexDirection: 'row', gap: 10, marginTop: 12 },
  footerButton: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  primary: { backgroundColor: PALETTE.green },
  secondary: { backgroundColor: '#c9cfe0' },
  footerText: { fontFamily: FONT_TITLE, fontSize: 10, color: PALETTE.ink },

  counter: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.gold, marginBottom: 4 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  placeThumb: { backgroundColor: PALETTE.ground, borderWidth: 2, borderColor: PALETTE.ink, padding: 3 },
  placeName: { fontFamily: FONT_TITLE, fontSize: 9, lineHeight: 14, color: PALETTE.ink },
  placeNear: { fontFamily: FONT_BODY, fontSize: 17, color: '#4a5068', marginTop: 2 },
  placeGo: { fontSize: 14, color: PALETTE.ink },
  placesHint: { fontFamily: FONT_BODY, fontSize: 18, color: '#b7c0d8', marginTop: 6 },
  soon: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  soonIcon: { fontSize: 40, color: PALETTE.gold },
  soonTitle: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.gold },
  soonText: { fontFamily: FONT_BODY, fontSize: 20, color: '#d5dbee', textAlign: 'center', paddingHorizontal: 8 },
});
