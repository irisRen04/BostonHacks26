import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'mbta-game/player';
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rand = (n) => Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

export default function usePlayer() {
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const p = raw ? JSON.parse(raw) : { id: rand(16), name: 'RIDER', code: rand(6), friends: [] };
        setPlayer(p);
        if (!raw) AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
      })
      .catch(() => setPlayer({ id: rand(16), name: 'RIDER', code: rand(6), friends: [] }));
  }, []);

  const update = useCallback((patch) => {
    setPlayer((p) => {
      const next = { ...p, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setName = (name) => update({ name: name.trim().slice(0, 12).toUpperCase() || 'RIDER' });
  const addFriend = (code) => {
    const c = code.trim().toUpperCase();
    if (!c || c === player?.code || player?.friends.includes(c)) return;
    update({ friends: [...player.friends, c] });
  };

  return { player, setName, addFriend };
}