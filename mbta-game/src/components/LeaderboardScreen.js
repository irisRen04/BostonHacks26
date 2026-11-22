import { useCallback, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchLeaderboard, leaderboardEnabled } from '../services/leaderboard';
import { FONT_BODY, FONT_TITLE, PALETTE } from '../theme/pixel';

export default function LeaderboardScreen({ player, xp, found, setName, addFriend, removeFriend, onClose }) {
  const [tab, setTab] = useState('friends'); // 'friends' | 'board'
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false); // shows the code input
  const [editingName, setEditingName] = useState(false); // shows the name input
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

  // Always show yourself with live local XP
  const board = [
    ...rows.filter((r) => r.friend_code !== player.code),
    { id: player.id, name: player.name, friend_code: player.code, xp, found },
  ].sort((a, b) => b.xp - a.xp);

  const byCode = Object.fromEntries(rows.map((r) => [r.friend_code, r]));

  const submitFriend = () => {
    addFriend(friendInput);
    setFriendInput('');
    setAdding(false);
    Keyboard.dismiss();
  };

  const submitName = () => {
    setName(nameInput);
    setEditingName(false);
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
      <View style={styles.panel}>
        <View style={styles.top}>
          <Text style={styles.title}>FRIENDS</Text>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>X</Text>
          </Pressable>
        </View>

        {/* you */}
        <View style={styles.me}>
          <View style={{ flex: 1 }}>
            {editingName ? (
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                onSubmitEditing={submitName}
                maxLength={12}
                autoFocus
                autoCapitalize="characters"
                returnKeyType="done"
              />
            ) : (
              <Text style={styles.myName}>{player.name}</Text>
            )}
            <Text style={styles.note}>
              CODE <Text style={styles.code}>{player.code}</Text> · {xp} XP
            </Text>
          </View>
          <Pressable style={styles.smallBtn} onPress={editingName ? submitName : () => setEditingName(true)}>
            <Text style={styles.btnText}>{editingName ? 'SAVE' : 'EDIT'}</Text>
          </Pressable>
        </View>

        {/* tabs */}
        <View style={styles.tabs}>
          {[
            ['friends', `FRIENDS (${player.friends.length})`],
            ['board', 'RANKING'],
          ].map(([id, label]) => (
            <Pressable key={id} style={[styles.tab, tab === id && styles.tabOn]} onPress={() => setTab(id)}>
              <Text style={[styles.tabText, tab === id && { color: PALETTE.ink }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
          {!leaderboardEnabled && <Text style={styles.note}>Leaderboard server not set up yet.</Text>}
          {error && <Text style={styles.note}>{error}</Text>}

          {tab === 'friends' && (
            <>
              {player.friends.length === 0 && <Text style={styles.note}>No friends yet. Tap ADD FRIEND below.</Text>}
              {player.friends.map((code) => {
                const f = byCode[code];
                return (
                  <View key={code} style={styles.rank}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{f ? f.name : code}</Text>
                      <Text style={styles.note}>
                        {f ? `${f.xp} XP · ${f.found} found` : 'waiting for them to open the app'}
                      </Text>
                    </View>
                    <Pressable style={styles.removeBtn} onPress={() => removeFriend(code)}>
                      <Text style={styles.btnText}>REMOVE</Text>
                    </Pressable>
                  </View>
                );
              })}
            </>
          )}

          {tab === 'board' &&
            board.map((r, i) => (
              <View key={r.id} style={[styles.rank, r.friend_code === player.code && styles.mine]}>
                <Text style={styles.pos}>{i + 1}</Text>
                <Text style={[styles.name, { flex: 1 }]}>{r.name}</Text>
                <Text style={styles.score}>{r.xp} XP</Text>
              </View>
            ))}
        </ScrollView>

        {/* actions */}
        {adding ? (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={friendInput}
              onChangeText={setFriendInput}
              onSubmitEditing={submitFriend}
              placeholder="FRIEND CODE"
              placeholderTextColor="#6b7393"
              autoCapitalize="characters"
              autoFocus
              maxLength={6}
              returnKeyType="done"
            />
            <Pressable style={styles.btn} onPress={submitFriend}>
              <Text style={styles.btnText}>ADD</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: '#4a5068' }]}
              onPress={() => {
                setAdding(false);
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.btnText}>X</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable style={[styles.btn, { flex: 1 }]} onPress={() => setAdding(true)}>
              <Text style={styles.btnText}>+ ADD FRIEND</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: '#4a5068' }]} onPress={load}>
              <Text style={styles.btnText}>REFRESH</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  panel: { maxHeight: '85%', backgroundColor: PALETTE.night, borderWidth: 3, borderColor: PALETTE.panelEdge, padding: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.gold },
  close: { width: 32, height: 32, backgroundColor: PALETTE.white, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: FONT_TITLE, fontSize: 10, color: PALETTE.ink },
  me: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#243041', padding: 10, marginBottom: 10 },
  myName: { fontFamily: FONT_TITLE, fontSize: 11, color: PALETTE.white, marginBottom: 4 },
  code: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.gold },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderWidth: 2, borderColor: PALETTE.panelEdge },
  tabOn: { backgroundColor: PALETTE.gold, borderColor: PALETTE.gold },
  tabText: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.white },
  input: { fontFamily: FONT_BODY, fontSize: 20, color: PALETTE.white, borderWidth: 2, borderColor: PALETTE.panelEdge, paddingHorizontal: 8, paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { backgroundColor: PALETTE.green, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  smallBtn: { backgroundColor: PALETTE.green, paddingHorizontal: 10, paddingVertical: 8 },
  removeBtn: { backgroundColor: '#a33', paddingHorizontal: 8, paddingVertical: 6 },
  btnText: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.white },
  note: { fontFamily: FONT_BODY, fontSize: 17, color: '#b7c0d8' },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: PALETTE.panelEdge },
  mine: { backgroundColor: '#243041' },
  pos: { fontFamily: FONT_TITLE, fontSize: 10, color: PALETTE.gold, width: 22 },
  name: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },
  score: { fontFamily: FONT_BODY, fontSize: 20, color: '#b7c0d8' },
});