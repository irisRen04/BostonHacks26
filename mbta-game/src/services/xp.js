import { landmarks } from '../data/landmarks'; // adjust if their file is named differently

export const BASE_XP = 100;
export const MAX_MULTIPLIER = 8; // 100, 200, 400, 800, then stays at 800
const XP_PER_LEVEL = 250;

// XP earned by the nth visit to a landmark (1 = first)
export const xpForVisit = (n) => BASE_XP * Math.min(2 ** (n - 1), MAX_MULTIPLIER);

// XP the NEXT visit to this landmark would give
export const nextVisitXp = (visits) => xpForVisit((visits ?? 0) + 1);

export function computeProgress(visits) {
  let xp = 0;
  let found = 0;
  for (const l of landmarks) {
    const n = visits[l.id] ?? 0;
    if (n > 0) found += 1;
    for (let k = 1; k <= n; k++) xp += xpForVisit(k);
  }
  return {
    xp,
    found,
    total: landmarks.length,
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpIntoLevel: xp % XP_PER_LEVEL,
    xpForLevel: XP_PER_LEVEL,
  };
}

export const landmarksAtStop = (stopId) => landmarks.filter((l) => l.nearestStop === stopId);