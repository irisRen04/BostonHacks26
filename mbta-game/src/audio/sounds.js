import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// require() paths must be written out literally in Expo
const SOURCES = {
  loading: require('../../assets/audio/loading-screen.mp3'),
  gameplay: require('../../assets/audio/general-gameplay.mp3'),
  minigame: require('../../assets/audio/minigame.mp3'),
  moreMinigame: require('../../assets/audio/more-minigame.mp3'),
  click: require('../../assets/audio/click.mp3'),
};

const players = {};
let current = null; // the music track that's currently selected
let muted = false;

function get(name) {
  if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
  return players[name];
}

// Call once at startup so sound plays even when the phone is on silent
export function initAudio() {
  return setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

// Looping background music. Switching tracks stops the old one.
export function playMusic(name, volume = 0.5) {
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

// Short one-shot sound, like the button click
export function playSfx(name = 'click', volume = 0.8) {
  if (muted) return;
  try {
    const p = get(name);
    p.volume = volume;
    p.seekTo(0);
    p.play();
  } catch {}
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