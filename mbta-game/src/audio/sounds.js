import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// require() paths must be written out literally in Expo
const SOURCES = {
  loading: require('../../assets/audio/loading-screen.mp3'),
  gameplay: require('../../assets/audio/general-gameplay.mp3'),
  minigame: require('../../assets/audio/minigame.mp3'),
  moreMinigame: require('../../assets/audio/more-minigame.mp3'),
  click: require('../../assets/audio/click.mp3'),
};

// Volumes run from 0 to 1. Turn these up or down to taste.
export const MUSIC_VOLUME = 0.01; // background music (quiet)
export const SFX_VOLUME = 1.0; // clicks (full)

const players = {};
let current = null;
let muted = false;

function get(name) {
  if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
  return players[name];
}

// Call once at startup: sound plays on silent mode, and the click is loaded ahead of time
export function initAudio() {
  get('click');
  return setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

export function playMusic(name, volume = MUSIC_VOLUME) {
  if (current === name) return;
  stopMusic();
  current = name;
  try {
    const p = get(name);
    p.loop = true;
    p.volume = volume;
    p.seekTo(0);
    if (!muted) p.play();
  } catch (e) {
    console.log('music error', e.message);
  }
}

export function stopMusic() {
  if (!current) return;
  try {
    get(current).pause();
  } catch {}
  current = null;
}

// Short one-shot sound. Rewinds first so rapid clicks all play.
export async function playSfx(name = 'click', volume = SFX_VOLUME) {
  if (muted) return;
  try {
    const p = get(name);
    p.volume = volume;
    await p.seekTo(0);
    p.play();
  } catch (e) {
    console.log('sfx error', e.message);
  }
}

export function setMuted(value) {
  muted = value;
  if (!current) return;
  try {
    if (value) get(current).pause();
    else get(current).play();
  } catch {}
}

export const isMuted = () => muted;