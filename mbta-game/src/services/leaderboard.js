const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

export const leaderboardEnabled = !!(URL && KEY);

export async function syncPlayer({ id, name, code, xp, found }) {
  if (!leaderboardEnabled) return;
  const res = await fetch(`${URL}/rest/v1/players?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id, name, friend_code: code, xp, found, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Sync failed: ${res.status} ${await res.text()}`);
}

// You + your friends, highest XP first
export async function fetchLeaderboard(myCode, friendCodes) {
  if (!leaderboardEnabled) return [];
  const codes = [myCode, ...friendCodes].join(',');
  const res = await fetch(
    `${URL}/rest/v1/players?friend_code=in.(${codes})&order=xp.desc&select=id,name,friend_code,xp,found`,
    { headers },
  );
  if (!res.ok) throw new Error(`Leaderboard error: ${res.status}`);
  return res.json();
}