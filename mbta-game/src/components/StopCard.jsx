import { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { getPredictions } from "../services/mbta";
import { formatDistance, minutesUntil } from "../services/proximity";

export default function StopCard({ stop }) {
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    const load = () =>
      getPredictions(stop.id).then(setPredictions).catch(console.error);
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [stop.id]);

  const upcoming = predictions
    .map((p) => ({ ...p, mins: minutesUntil(p.time) }))
    .filter((p) => p.mins !== null && p.mins >= 0);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{stop.attributes.name}</Text>
          <Text style={styles.muted}>{formatDistance(stop.meters)} away</Text>
        </View>
        <Text style={styles.pill}>🚶 {stop.walkMinutes} min</Text>
      </View>

      {upcoming.length === 0 ? (
        <Text style={[styles.muted, { marginTop: 12 }]}>
          No upcoming trains right now.
        </Text>
      ) : (
        upcoming.map((p) => {
          const canMakeIt = p.mins >= stop.walkMinutes;
          return (
            <View
              key={p.id}
              style={[styles.row, { borderLeftColor: p.routeColor || "#888" }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.line}>{p.routeName}</Text>
                {p.direction ? (
                  <Text style={styles.muted}>to {p.direction}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.mins}>
                  {p.mins === 0 ? "Now" : `${p.mins} min`}
                </Text>
                <Text
                  style={{
                    color: canMakeIt ? "#22c55e" : "#ef4444",
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {canMakeIt ? "You can make it" : "Too soon"}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1a2029", borderRadius: 14, padding: 16, marginBottom: 14 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  name: { color: "#f1f5f9", fontSize: 18, fontWeight: "600" },
  muted: { color: "#8b98a9", fontSize: 13 },
  pill: {
    color: "#f1f5f9",
    backgroundColor: "#243041",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121821",
    borderRadius: 10,
    borderLeftWidth: 5,
    padding: 10,
    marginTop: 8,
  },
  line: { color: "#f1f5f9", fontWeight: "600" },
  mins: { color: "#f1f5f9", fontSize: 18, fontWeight: "700" },
});