import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useRankedStops } from "../hooks/useRankedStops";
import { formatDistance } from "../services/proximity";

export default function RankedStops() {
 const { coords, ranked, stopCount, error } = useRankedStops();

  if (error) return <Text style={[styles.msg, { color: "#ef4444" }]}>{error}</Text>;
  if (coords && stopCount === 0) {
  return <Text style={styles.msg}>No T stops found near you.</Text>;
}

  if (!coords || ranked.length === 0) {
    return (
      <View style={{ paddingTop: 40 }}>
        <ActivityIndicator color="#f1f5f9" />
        <Text style={styles.msg}>Finding you and the stops...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={ranked.slice(0, 15)}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ paddingBottom: 40 }}
      renderItem={({ item, index }) => (
        <View style={[styles.row, index === 0 && styles.closest]}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.muted}>🚶 {item.walkMinutes} min walk</Text>

            <Text style={styles.msg}>
  Location: {coords ? "got it" : "waiting..."}{"\n"}
  Stops loaded: {stopCount}
</Text>
          </View>
          <Text style={styles.dist}>{formatDistance(item.meters)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  msg: { color: "#8b98a9", textAlign: "center", marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2029",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  closest: { borderWidth: 1.5, borderColor: "#22c55e" },
  rank: { color: "#8b98a9", fontSize: 18, fontWeight: "700", width: 28 },
  name: { color: "#f1f5f9", fontSize: 16, fontWeight: "600" },
  muted: { color: "#8b98a9", fontSize: 12, marginTop: 2 },
  dist: { color: "#f1f5f9", fontSize: 16, fontWeight: "700" },
});