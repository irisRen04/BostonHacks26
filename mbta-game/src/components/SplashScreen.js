import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { playSfx } from '../audio/sounds';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';

// [left %, top %, size] for the night-sky stars
const STARS = [
  [8, 8, 4], [22, 18, 3], [70, 6, 4], [88, 20, 3], [42, 12, 3],
  [14, 34, 3], [92, 40, 4], [60, 28, 3], [30, 46, 4], [80, 52, 3],
];

const TIES = Array.from({ length: 16 }, (_, i) => i);

/** Title screen: hopping mascot, game name, and a START button. */
export default function SplashScreen({ onStart }) {
  const hop = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(true);

  // mascot hops up and down
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(260),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hop]);

  // stars twinkle
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [twinkle]);

  // blinking prompt
 

  const lift = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const shadowScale = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });
  const starA = twinkle;
  const starB = twinkle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] });

  return (
    <View style={styles.page}>
      {/* night sky */}
      {STARS.map(([x, y, s], i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            { left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: i % 2 ? starA : starB },
          ]}
        />
      ))}

      {/* title */}
      <View style={styles.titleWrap}>
        <Text style={[styles.title, styles.titleShadow]}>T-HOPPERS</Text>
        <Text style={[styles.title, styles.titleMain]}>T-HOPPERS</Text>
      </View>
      <Text style={styles.tagline}>hop on · explore Boston</Text>

      {/* mascot */}
      <View style={styles.mascotWrap}>
        <Animated.View style={{ transform: [{ translateY: lift }] }}>
          <Image
            source={require('../../assets/pixil-frame-0.png')}
            style={[styles.mascot, Platform.OS === 'web' && { imageRendering: 'pixelated' }]}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.View style={[styles.shadow, { transform: [{ scaleX: shadowScale }] }]} />
      </View>

      {/* start button */}
      <Pressable
        onPress={() => {
          playSfx('click');
          onStart?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Start"
        style={({ pressed }) => [styles.btn, pressed ? styles.btnPressed : styles.btnUp]}
      >
        <Text style={styles.btnText}>START</Text>
      </Pressable>
      <Text style={[styles.hint, !blink && { opacity: 0 }]}>▶ TAP START TO HOP ON</Text>

      {/* the track along the bottom */}
      <View style={styles.track} pointerEvents="none">
        <View style={styles.rail} />
        <View style={styles.ties}>
          {TIES.map((i) => (
            <View key={i} style={styles.tie} />
          ))}
        </View>
        <View style={styles.rail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PALETTE.night,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  star: { position: 'absolute', backgroundColor: '#fff3b0' },

  titleWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: FONT_TITLE, fontSize: 28, letterSpacing: 1 },
  titleShadow: { position: 'absolute', color: PALETTE.ink, top: 4, left: 4 },
  titleMain: { color: PALETTE.gold },
  tagline: { fontFamily: FONT_BODY, fontSize: 22, color: '#b7c0d8', marginBottom: 18 },

  mascotWrap: { alignItems: 'center', justifyContent: 'center', height: 230, marginBottom: 10 },
  mascot: { width: 190, height: 190 },
  shadow: { width: 110, height: 12, borderRadius: 6, backgroundColor: '#000', opacity: 0.35, marginTop: 4 },

  btn: {
    minWidth: 190,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: PALETTE.green,
    borderWidth: 4,
    borderColor: PALETTE.ink,
  },
  btnUp: { boxShadow: `5px 5px 0px ${PALETTE.ink}` },
  btnPressed: { transform: [{ translateX: 5 }, { translateY: 5 }], backgroundColor: PALETTE.greenLight },
  btnText: { fontFamily: FONT_TITLE, fontSize: 16, color: PALETTE.white },
  hint: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.gold, marginTop: 16 },

  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 34, justifyContent: 'center', backgroundColor: PALETTE.ground },
  rail: { height: 4, backgroundColor: PALETTE.greenDark },
  ties: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, height: 14, alignItems: 'center' },
  tie: { width: 8, height: 14, backgroundColor: '#6b4423' },
});