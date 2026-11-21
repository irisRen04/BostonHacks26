// Shared retro-game UI pieces.
import { Pressable, StyleSheet } from 'react-native';

import { PALETTE } from '../theme/pixel';

/** Chunky pixel button: square corners, hard drop shadow that disappears when pressed. */
export function PixelButton({ onPress, style, children, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [ui.button, pressed ? ui.buttonPressed : ui.buttonUp, style]}
    >
      {children}
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  button: { backgroundColor: PALETTE.white, borderWidth: 3, borderColor: PALETTE.ink },
  buttonUp: { boxShadow: `3px 3px 0px ${PALETTE.ink}` },
  buttonPressed: { transform: [{ translateX: 3 }, { translateY: 3 }], backgroundColor: PALETTE.gold },
  // RPG-style dialog box: square corners, light border, hard offset shadow
  panel: {
    backgroundColor: PALETTE.night,
    borderWidth: 4,
    borderColor: PALETTE.panelEdge,
    boxShadow: `6px 6px 0px ${PALETTE.ink}`,
  },
});
