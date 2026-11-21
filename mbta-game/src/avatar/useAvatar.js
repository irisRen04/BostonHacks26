import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_AVATAR, sanitizeAvatar } from './avatar';

const STORAGE_KEY = 'mbta-game/avatar';

/** The rider's avatar, saved on the device so it survives restarts. */
export default function useAvatar() {
  const [avatar, setAvatarState] = useState(DEFAULT_AVATAR);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && raw) setAvatarState(sanitizeAvatar(JSON.parse(raw)));
      })
      .catch(() => {}); // unreadable save: keep the default avatar
    return () => {
      cancelled = true;
    };
  }, []);

  const setAvatar = useCallback((next) => {
    const clean = sanitizeAvatar(next);
    setAvatarState(clean);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean)).catch(() => {});
  }, []);

  return [avatar, setAvatar];
}
