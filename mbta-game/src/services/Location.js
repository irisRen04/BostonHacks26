import * as Location from "expo-location";

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("Location permission denied");
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

// Async now. Resolves to a function that stops tracking.
export async function watchLocation(onUpdate, onError) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      onError(new Error("Location permission denied"));
      return () => {};
    }

    // 1. Instant position if the phone already knows one
    const last = await Location.getLastKnownPositionAsync();
    if (last) {
      onUpdate({ lat: last.coords.latitude, lng: last.coords.longitude });
    }

    // 2. Fresh, lower-accuracy fix (much faster than High)
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) =>
        onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      )
      .catch((e) => onError(e));

    // 3. Keep tracking as you move
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
      (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    );
    return () => sub.remove();
  } catch (e) {
    onError(e);
    return () => {};
  }
}

// Distance in meters between two points
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}