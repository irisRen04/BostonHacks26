import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// require() paths must be written out literally in Expo
const SOURCES = {
  loading: require('../../assets/audio/loading-screen.mp3'),
  gameplay: require('../../assets/audio/general-gameplay.mp3'),
  minigame: require('../../assets/audio/minigame.mp3'),
  moreMinigame: require('../../assets/audio/more-minigame.mp3'),
  click: require('../../assets/audio/click.mp3'),
  levelup: require('../../assets/audio/levelup.mp3'),
  chimes: require('../../assets/audio/morechimes.mp3'),
};

export const MUSIC_VOLUME = 0.05;
export const SFX_VOLUME = 1.0;

// Higher number = more important. A sound can't interrupt a more important one that's still playing.
const PRIORITY = { click: 1, chimes: 2, levelup: 3 };
// Roughly how long each sound lasts, in seconds. Adjust if a sound gets cut off or blocks others too long.
const LENGTH = { click: 0.4, chimes: 1.6, levelup: 2.2 };

const musicPlayers = {};
let currentMusic = null;
let muted = false;
let activeSfx = null; // { player, name, until }

function getMusic(name) {
  if (!musicPlayers[name]) musicPlayers[name] = createAudioPlayer(SOURCES[name]);
  return musicPlayers[name];
}

export function initAudio() {
  return setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

export function playMusic(name, volume = MUSIC_VOLUME) {
  if (currentMusic === name) return;
  stopMusic();
  currentMusic = name;
  try {
    const p = getMusic(name);
    p.loop = true;
    p.volume = volume;
    p.seekTo(0);
    if (!muted) p.play();
    p.volume = volume;
  } catch (e) {
    console.log('music error', e.message);
  }
}

export function stopMusic() {
  if (!currentMusic) return;
  try {
    getMusic(currentMusic).pause();
  } catch {}
  currentMusic = null;
}

function dropActive() {
  if (!activeSfx) return;
  try {
    activeSfx.player.pause();
    activeSfx.player.remove();
  } catch {}
  activeSfx = null;
}

// One sound effect at a time. Returns true if it played.
export function playSfx(name = 'click', volume = SFX_VOLUME) {
  if (muted || !SOURCES[name]) return false;
  const now = Date.now();

  if (activeSfx && now < activeSfx.until) {
    // something is still playing: only replace it with an equal or more important sound
    if ((PRIORITY[name] ?? 1) < (PRIORITY[activeSfx.name] ?? 1)) return false;
    dropActive();
  } else {
    dropActive();
  }

  try {
    const player = createAudioPlayer(SOURCES[name]);
    player.volume = volume;
    player.play();
    activeSfx = { player, name, until: now + (LENGTH[name] ?? 1) * 1000 };
    const mine = activeSfx;
    setTimeout(() => {
      if (activeSfx === mine) dropActive();
    }, (LENGTH[name] ?? 1) * 1000 + 1500);
    return true;
  } catch (e) {
    console.log('sfx error', e.message);
    return false;
  }
}

export function setMuted(value) {
  muted = value;
  if (value) dropActive();
  if (!currentMusic) return;
  try {
    if (value) getMusic(currentMusic).pause();
    else getMusic(currentMusic).play();
  } catch {}
}

export const isMuted = () => muted;