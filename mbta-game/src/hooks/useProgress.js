import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeProgress } from '../services/xp';

const STORAGE_KEY = 'mbta-game/landmark-visits';
const BONUS_XP_KEY = 'mbta-game/minigame-xp';

export default function useProgress() {
  const [visits, setVisits] = useState({});
  const [bonusXP, setBonusXP] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [lastGain, setLastGain] = useState(null);

  // Load saved landmark visits and minigame XP
  useEffect(() => {
    let active = true;

    async function loadProgress() {
      try {
        const [savedVisits, savedBonusXP] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(BONUS_XP_KEY),
        ]);

        if (!active) return;

        if (savedVisits) {
          setVisits(JSON.parse(savedVisits));
        }

        if (savedBonusXP !== null) {
          const amount = Number(savedBonusXP);

          if (Number.isFinite(amount) && amount >= 0) {
            setBonusXP(amount);
          }
        }
      } catch (error) {
        console.warn('Failed to load progress:', error);
      } finally {
        if (active) setLoaded(true);
      }
    }

    loadProgress();

    return () => {
      active = false;
    };
  }, []);

  // Award landmark XP by recording visits
  const recordVisit = useCallback((ids) => {
    setVisits((prev) => {
      const next = { ...prev };

      ids.forEach((id) => {
        next[id] = (next[id] ?? 0) + 1;
      });

      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      ).catch(console.warn);

      return next;
    });
  }, []);

  // Award XP for completing minigames
  const addMinigameXP = useCallback((amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;

    setBonusXP((prev) => {
      const next = prev + amount;

      AsyncStorage.setItem(
        BONUS_XP_KEY,
        String(next)
      ).catch(console.warn);

      return next;
    });

    setLastGain(amount);
  }, []);

  // Combine landmark XP and minigame XP
  const progress = useMemo(
    () => computeProgress(visits, bonusXP),
    [visits, bonusXP]
  );

  return {
    visits,
    loaded,
    recordVisit,
    bonusXP,
    addMinigameXP,
    lastGain,
    setLastGain,
    ...progress,
  };
}