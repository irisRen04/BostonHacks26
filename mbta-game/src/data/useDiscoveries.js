import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { landmarksById } from './landmarks';

const STORAGE_KEY = 'mbta-game/discovered';

/** Which landmarks the rider has discovered ({ [id]: true }), saved on the device. */
export default function useDiscoveries() {
  const [discovered, setDiscovered] = useState({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setDiscovered(Object.fromEntries(ids.filter((id) => landmarksById[id]).map((id) => [id, true])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const discover = useCallback((id) => {
    setDiscovered((d) => {
      if (d[id]) return d;
      const next = { ...d, [id]: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.keys(next))).catch(() => {});
      return next;
    });
  }, []);

  return [discovered, discover];
}
