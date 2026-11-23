import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useNearbyStops } from "../hooks/useNearbyStops";
import StopCard from "./StopCard";

export default function NearbyStops() {
  const { coords, error, stops } = useNearbyStops();

  if (error) return <Text style={[styles.msg, { color: "#ef4444" }]}>{error}</Text>;

  if (!coords) {
    return (
      <View style={{ paddingTop: 40 }}>
        <ActivityIndicator color="#f1f5f9" />
        <Text style={styles.msg}>Finding you...</Text>
      </View>
    );
  }

  if (stops.length === 0) return <Text style={styles.msg}>No T stops nearby.</Text>;

  return (
    <FlatList
      data={stops.slice(0, 5)}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <StopCard stop={item} />}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  );
}

const styles = StyleSheet.create({
  msg: { color: "#8b98a9", textAlign: "center", marginTop: 12 },
});