import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeProgress } from '../services/xp';

const STORAGE_KEY = 'mbta-game/landmark-visits';

export default function useProgress() {
  const [visits, setVisits] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [lastGain, setLastGain] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setVisits(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Call once per arrival at a stop with the landmark ids there
  const recordVisit = useCallback((ids) => {
    setVisits((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = (next[id] ?? 0) + 1));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const progress = useMemo(() => computeProgress(visits), [visits]);
  return { visits, loaded, recordVisit, lastGain, setLastGain, ...progress };
}