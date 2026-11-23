import { memo, useMemo } from 'react';
import { View } from 'react-native';

/** Merge horizontal runs of the same colour so a sprite is ~50 Views, not hundreds. */
function toRuns(rows, palette) {
  const runs = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let n = 1;
      while (x + n < row.length && row[x + n] === ch) n += 1;
      const color = palette[ch];
      if (ch !== '.' && color) runs.push({ key: `${x}-${y}`, x, y, n, color });
      x += n;
    }
  });
  return runs;
}

/** Draws a sprite (array of strings + palette) at `px` screen pixels per sprite pixel. */
const PixelArt = memo(function PixelArt({ rows, palette, px, flip = false, style }) {
  const runs = useMemo(() => toRuns(rows, palette), [rows, palette]);
  return (
    <View
      pointerEvents="none"
      style={[
        { width: rows[0].length * px, height: rows.length * px },
        flip && { transform: [{ scaleX: -1 }] },
        style,
      ]}
    >
      {runs.map((r) => (
        <View
          key={r.key}
          style={{
            position: 'absolute',
            left: r.x * px,
            top: r.y * px,
            width: r.n * px,
            height: px,
            backgroundColor: r.color,
          }}
        />
      ))}
    </View>
  );
});

export default PixelArt;
