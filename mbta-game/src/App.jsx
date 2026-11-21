import { View, Text, StyleSheet, StatusBar } from "react-native";
import RankedStops from "./components/RankedStops";

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>🚇 MBTA Game</Text>
      <Text style={styles.subtitle}>Which T stop is closest?</Text>
      <RankedStops />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1419", paddingTop: 60, paddingHorizontal: 16 },
  title: { color: "#f1f5f9", fontSize: 26, fontWeight: "700" },
  subtitle: { color: "#8b98a9", marginBottom: 16 },
});