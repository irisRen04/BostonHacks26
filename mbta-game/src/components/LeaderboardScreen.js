import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchLeaderboard, leaderboardEnabled } from '../services/leaderboard';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';

export default function LeaderboardScreen({ player, xp, found, setName, addFriend, onClose }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [friendInput, setFriendInput] = useState('');
  const [nameInput, setNameInput] = useState(player.name);

  const load = useCallback(() => {
    fetchLeaderboard(player.code, player.friends)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [player.code, player.friends]);

  useEffect(() => {
    load();
  }, [load]);

  // Always show yourself with live local XP, even before the first sync lands
  const merged = [
    ...rows.filter((r) => r.friend_code !== player.code),
    { id: player.id, name: player.name, friend_code: player.code, xp, found },
  ].sort((a, b) => b.xp - a.xp);

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.top}>
          <Text style={styles.title}>FRIENDS</Text>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>X</Text>
          </Pressable>
        </View>

        <ScrollView>
          <Text style={styles.label}>YOUR FRIEND CODE</Text>
          <Text style={styles.code}>{player.code}</Text>

          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput
            style={styles.input}
            value={nameInput}
            onChangeText={setNameInput}
            onEndEditing={() => setName(nameInput)}
            maxLength={12}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>ADD A FRIEND</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={friendInput}
              onChangeText={setFriendInput}
              placeholder="CODE"
              placeholderTextColor="#6b7393"
              autoCapitalize="characters"
              maxLength={6}
            />
            <Pressable
              style={styles.btn}
              onPress={() => {
                addFriend(friendInput);
                setFriendInput('');
              }}
            >
              <Text style={styles.btnText}>ADD</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>LEADERBOARD</Text>
          {!leaderboardEnabled && <Text style={styles.note}>Leaderboard server not set up yet.</Text>}
          {error && <Text style={styles.note}>{error}</Text>}
          {merged.map((r, i) => (
            <View key={r.id} style={[styles.rank, r.friend_code === player.code && styles.me]}>
              <Text style={styles.pos}>{i + 1}</Text>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.score}>{r.xp} XP</Text>
            </View>
          ))}
          <Pressable style={[styles.btn, { marginTop: 10 }]} onPress={load}>
            <Text style={styles.btnText}>REFRESH</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  panel: { maxHeight: '85%', backgroundColor: PALETTE.night, borderWidth: 3, borderColor: PALETTE.panelEdge, padding: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.gold },
  close: { width: 32, height: 32, backgroundColor: PALETTE.white, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: FONT_TITLE, fontSize: 10, color: PALETTE.ink },
  label: { fontFamily: FONT_TITLE, fontSize: 7, color: PALETTE.gold, marginTop: 12, marginBottom: 4 },
  code: { fontFamily: FONT_TITLE, fontSize: 16, color: PALETTE.white },
  input: { fontFamily: FONT_BODY, fontSize: 20, color: PALETTE.white, borderWidth: 2, borderColor: PALETTE.panelEdge, paddingHorizontal: 8, paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { backgroundColor: PALETTE.green, paddingHorizontal: 12, justifyContent: 'center', paddingVertical: 6 },
  btnText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },
  note: { fontFamily: FONT_BODY, fontSize: 17, color: '#b7c0d8' },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: PALETTE.panelEdge },
  me: { backgroundColor: '#243041' },
  pos: { fontFamily: FONT_TITLE, fontSize: 10, color: PALETTE.gold, width: 22 },
  name: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white, flex: 1 },
  score: { fontFamily: FONT_BODY, fontSize: 20, color: '#b7c0d8' },
});