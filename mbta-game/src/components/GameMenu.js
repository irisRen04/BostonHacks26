import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT_TITLE, PALETTE } from '../theme/pixel';
import AvatarSprite from './AvatarSprite';
import { PixelButton, ui } from './ui';

export const MENU_ITEMS = [
  { id: 'customize', icon: '✎', label: 'CUSTOMIZE' },
  { id: 'places', icon: '★', label: 'PLACES TO VISIT' },
  { id: 'friends', icon: '☺', label: 'FRIENDS' },
  { id: 'settings', icon: '⚙', label: 'SETTINGS' },
];

/**
 * The rider's avatar in the bottom-right corner. Tapping it opens the game menu;
 * picking an item calls onOpen(itemId).
 */
export default function GameMenu({ avatar, bottom, onOpen }) {
  const [open, setOpen] = useState(false);

  const choose = (id) => {
    setOpen(false);
    onOpen(id);
  };

  return (
    <>
      {/* tap anywhere outside to close */}
      {open && <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close menu" />}

      {open && (
        <View style={[ui.panel, styles.menu, { bottom: bottom + BUTTON_SIZE + 14 }]}>
          <Text style={styles.menuTitle}>MENU</Text>
          {MENU_ITEMS.map((item) => (
            <PixelButton key={item.id} onPress={() => choose(item.id)} style={styles.item}>
              <Text style={styles.itemIcon}>{item.icon}</Text>
              <Text style={styles.itemText}>{item.label}</Text>
            </PixelButton>
          ))}
        </View>
      )}

      <PixelButton
        onPress={() => setOpen((v) => !v)}
        style={[styles.avatarButton, { bottom }, open && styles.avatarButtonOpen]}
        accessibilityLabel="Open menu"
      >
        <AvatarSprite avatar={avatar} px={3} />
      </PixelButton>
    </>
  );
}

const BUTTON_SIZE = 64;

const styles = StyleSheet.create({
  avatarButton: {
    position: 'absolute',
    right: 14,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.ground,
    overflow: 'hidden',
  },
  avatarButtonOpen: { backgroundColor: PALETTE.gold },
  menu: { position: 'absolute', right: 14, width: 230, padding: 10, gap: 8 },
  menuTitle: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.gold, marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9 },
  itemIcon: { fontSize: 15, width: 18, textAlign: 'center', color: PALETTE.ink },
  itemText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.ink },
});
