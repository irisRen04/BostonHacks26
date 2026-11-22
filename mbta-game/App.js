import { StatusBar } from 'expo-status-bar';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { initAudio, playMusic, playSfx } from './src/audio/sounds';
import useAvatar from './src/avatar/useAvatar';
import GameMenu from './src/components/GameMenu';
import LandmarkCard, { DiscoveryPopup } from './src/components/LandmarkCard';
import LeaderboardScreen from './src/components/LeaderboardScreen';
import StationCard from './src/components/StationCard';
import TrainCard from './src/components/TrainCard';
import TransitMap from './src/components/TransitMap';

import TeapotGame from './src/components/TeapotGame';
import DuckGame from './src/components/DuckGame';
import LobsterGame from './src/components/LobsterGame';
import SplashScreen from './src/components/SplashScreen';
import { ComingSoonScreen, CustomizeScreen, PlacesScreen } from './src/components/screens';
import { isJunction, routeOptions, stations, stationsById } from './src/data/greenLine';
import { landmarks, landmarksById } from './src/data/landmarks';
import useDiscoveries from './src/data/useDiscoveries';
import usePlayer from './src/hooks/usePlayer';
import useProgress from './src/hooks/useProgress';
import { useRankedStops } from './src/hooks/useRankedStops';
import { useWalkingInfo } from './src/hooks/useWalkingInfo';
import { syncPlayer } from './src/services/leaderboard';
import { formatDistance } from './src/services/proximity';
import { rideBetween } from './src/services/ride';
import { landmarksAtStop } from './src/services/xp';
import { useArrivals, useLiveTrains } from './src/live/mbta';
import { FONT_BODY, FONT_TITLE, PALETTE } from './src/theme/pixel';

// "Park Street" vs "park st." shouldn't break name matching
const normName = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const stationByName = Object.fromEntries(stations.map((s) => [normName(s.name), s]));
const boylstonId = stationByName.boylston?.id;
const northStationId = stationByName.northstation?.id;

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular, VT323_400Regular });

  // Music: loading track while fonts load, then the gameplay track
  // Music: loading track on the title screen, gameplay track once the player taps START
  useEffect(() => {
    initAudio();
  }, []);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    playMusic(started ? 'gameplay' : 'loading');
  }, [started]);

  const mapRef = useRef(null);
  // The rider's position: the stop they're at, and the stop they just came from.
  const [trip, setTrip] = useState({ currentId: null, previousId: null });
  const selectedId = trip.currentId;
  const selected = selectedId ? stationsById[selectedId] : null;
  const [avatar, setAvatar] = useAvatar();
  const [discovered, discover] = useDiscoveries();
  // Landmark whose card is open, and newly discovered ones waiting for their popup.
  const [landmarkId, setLandmarkId] = useState(null);
  const [discoveryQueue, setDiscoveryQueue] = useState([]);
  const landmark = landmarkId ? landmarksById[landmarkId] : null;
  // Which menu screen is open: null, 'customize', 'places', 'friends' or 'settings'.
  
  const [screen, setScreen] = useState(null);

  // ---- minigames ----
  const [showTeapotGame, setShowTeapotGame] = useState(false);
  const [duckOpen, setDuckOpen] = useState(false);
  const [lobsterOpen, setLobsterOpen] = useState(false);
  useEffect(() => {
    if (selectedId && selectedId === boylstonId) setDuckOpen(true);
  }, [selectedId]);
  useEffect(() => {
    if (selectedId && selectedId === northStationId) setLobsterOpen(true);
  }, [selectedId]);
  useEffect(() => {
    if (selected?.name === 'Government Center') setShowTeapotGame(true);
  }, [selectedId]);

  // The corner avatar button sits just above the stop card when one is showing.
  const [cardHeight, setCardHeight] = useState(0);
  // Live Green Line trains, and the one whose card is open.
  const live = useLiveTrains();
  const [trainId, setTrainId] = useState(null);
  const train = trainId ? live.trains.find((t) => t.id === trainId) : null;

  // The train you're waiting for at your stop: the arrival you tapped on the NEXT TRAINS
  // board, or else the soonest one that's on the map. Only that train pulses.
  const arrivals = useArrivals(selectedId);
  const [watchId, setWatchId] = useState(null);
  useEffect(() => setWatchId(null), [selectedId]);
  const watched = useMemo(() => {
    const onMap = new Set(live.trains.map((t) => t.id));
    const list = arrivals.arrivals.filter((a) => a.vehicleId && onMap.has(a.vehicleId));
    return list.find((a) => a.id === watchId) ?? list[0] ?? null;
  }, [arrivals.arrivals, live.trains, watchId]);
  const waitingFor = watched ? { trainId: watched.vehicleId, minutes: watched.minutes } : null;

  // Fewer trains on the map: with a stop selected, only trains on its branches or close by
  // (plus your train and the one whose card is open). With no stop, every train shows.
  const visibleTrains = useMemo(() => {
    if (!selected) return live.trains;
    return live.trains.filter(
      (t) =>
        t.id === waitingFor?.trainId ||
        t.id === trainId ||
        selected.branches.includes(t.branch) ||
        Math.hypot(t.to.x - selected.x, t.to.y - selected.y) < NEARBY_M,
    );
  }, [live.trains, selected, waitingFor?.trainId, trainId]);

  // How much of the map the open card covers, so the map keeps the stop visible above it.
  const cardOpen = !!(selected || landmark || train);
  const cardInset = cardOpen ? CARD_BOTTOM + cardHeight + 8 : 0;
  // at a junction the signposts reach ~80 points around the stop, so leave room below it too
  const stopInset = (id) => cardInsetRef.current + (id && isJunction(id) ? SIGN_ROOM : 0);
  const cardInsetRef = useRef(0);
  cardInsetRef.current = cardInset;

  // At a junction: the sign the rider has tapped once (tapping it again rides there).
  const [activeSignId, setActiveSignId] = useState(null);

  // Tapping a stop on the map drops the rider there (no previous stop yet).
  const placeAt = useCallback((id) => {
    setActiveSignId(null);
    setLandmarkId(null);
    setTrainId(null);
    setTrip({ currentId: id, previousId: null });
    if (id) mapRef.current?.focusStation(stationsById[id], 0.25, stopInset(id));
  }, []);

  // Riding to a connected stop from the card remembers where we came from and follows the rider.
  const rideTo = useCallback((id) => {
    setActiveSignId(null);
    setLandmarkId(null);
    setTrainId(null);
    setTrip((t) => ({ currentId: id, previousId: t.currentId }));
    mapRef.current?.focusStation(stationsById[id], 0.25, stopInset(id));
  }, []);

  // ---- XP: each arrival at a stop is a visit to its landmarks ----
  const progress = useProgress();
  const { loaded, recordVisit } = progress;
  useEffect(() => {
    if (!loaded || !selectedId) return;
    const here = landmarksAtStop(selectedId).map((l) => l.id);
    if (here.length) recordVisit(here);
  }, [loaded, selectedId, recordVisit]);

  // ---- Leaderboard: push my score whenever it changes ----
  const { player, setName, addFriend, removeFriend } = usePlayer();
  useEffect(() => {
    if (!player || !loaded) return;
    syncPlayer({
      id: player.id,
      name: player.name,
      code: player.code,
      xp: progress.xp,
      found: progress.found,
    }).catch(() => {});
  }, [player?.id, player?.name, progress.xp, progress.found, loaded]);

  // ---- Nearest stop to the user's real location ----
  const { ranked, coords } = useRankedStops();

  // Ranked stops that also exist on the map, closest first
  const rankedOnMap = useMemo(
    () =>
      ranked
        .map((r) => ({ ...r, station: stationByName[normName(r.name)] }))
        .filter((r) => r.station),
    [ranked],
  );
  const nearest = rankedOnMap[0] ?? null;

  // Spawn the avatar at the nearest stop, once
  const hasSpawned = useRef(false);
  useEffect(() => {
    if (hasSpawned.current || !nearest) return;
    hasSpawned.current = true;
    placeAt(nearest.station.id);
  }, [nearest, placeAt]);

  // Real walking routes for the 3 closest stops, plus the stop the avatar is on
  const selectedRow = selected ? rankedOnMap.find((r) => r.station.id === selected.id) : null;
  const walkTargets = useMemo(() => {
    const rows = rankedOnMap.slice(0, 3);
    if (selectedRow && !rows.includes(selectedRow)) rows.push(selectedRow);
    return rows.map((r) => ({ id: r.station.id, lat: r.lat, lng: r.lng }));
  }, [rankedOnMap, selectedRow]);
  const walking = useWalkingInfo(coords, walkTargets);

  // Info for whichever stop the avatar is on (falls back to the nearest)
  const row = selectedRow ?? nearest;
  const route = row ? walking[row.station.id] : null;
  const info = row
    ? {
        station: row.station,
        straightMeters: row.meters,
        meters: route ? route.meters : row.meters * 1.3,
        walkMinutes: route ? route.minutes : row.walkMinutes,
        exact: !!route,
      }
    : null;
  const isNearest = !!(info && nearest && info.station.id === nearest.station.id);

  // Train leg: from the stop you'd board at (nearest) to the stop the avatar is on
  const coordsById = useMemo(
    () => Object.fromEntries(rankedOnMap.map((r) => [r.station.id, { lat: r.lat, lng: r.lng }])),
    [rankedOnMap],
  );
  const ride =
    info && nearest && !isNearest
      ? rideBetween(nearest.station.id, info.station.id, coordsById)
      : null;
  const walkToBoard = nearest ? walking[nearest.station.id]?.minutes ?? nearest.walkMinutes : 0;
  const totalMin = ride ? walkToBoard + ride.minutes : null;

  useEffect(() => {
    const target = landmark ?? selected;
    const signRoom = !landmark && selected && isJunction(selected.id) ? SIGN_ROOM : 0;
    if (target && cardHeight) mapRef.current?.keepVisible(target, cardInset + signRoom);
  }, [cardHeight, cardInset, landmark, selected]);

  // Arriving at a stop discovers every landmark whose nearest stop it is (one popup each).
  useEffect(() => {
    if (!selectedId) return;
    const found = landmarks.filter((l) => l.nearestStop === selectedId && !discovered[l.id]).map((l) => l.id);
    if (!found.length) return;
    found.forEach(discover);
    setDiscoveryQueue((q) => [...q, ...found.filter((id) => !q.includes(id))]);
  }, [selectedId, discovered, discover]);

  // Chimes each time a new landmark popup shows up
  const popupId = discoveryQueue[0];
  useEffect(() => {
    if (popupId) playSfx('chimes');
  }, [popupId]);

  // Level-up sound: only when the level goes up, not when saved progress loads
  const prevLevel = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    if (prevLevel.current !== null && progress.level > prevLevel.current) {
      setTimeout(() => playSfx('levelup'), 1700); // after the discovery chimes
    }
    prevLevel.current = progress.level;
  }, [loaded, progress.level]);

  const openLandmark = useCallback((id) => {
    setTrainId(null);
    setLandmarkId(id);
    mapRef.current?.focusStation(landmarksById[id], 0.25, cardInsetRef.current);
  }, []);

  // One sign per way out of a junction; the way you came in is the BACK sign.
  const signs = useMemo(() => {
    if (!selectedId || !isJunction(selectedId)) return null;
    return routeOptions(selectedId).map((o) => ({
      id: o.id,
      kind: o.id === trip.previousId ? 'back' : 'branch',
      branches: o.branches,
    }));
  }, [selectedId, trip.previousId]);

  const pressSign = useCallback(
    (id) => {
      if (id === activeSignId) rideTo(id);
      else setActiveSignId(id);
    },
    [activeSignId, rideTo],
  );

  if (!fontsLoaded) return <View style={styles.page} />;
  if (!started) return <SplashScreen onStart={() => setStarted(true)} />;

  return (
    <View style={styles.page}>
      <View style={styles.phone}>
        <TransitMap
          ref={mapRef}
          selectedId={selectedId}
          onSelectStation={(id) => {
            if (id) playSfx('click');
            placeAt(id);
          }}
          avatar={avatar}
          signs={signs}
          activeSignId={activeSignId}
          onSignPress={pressSign}
          discovered={discovered}
          onLandmarkPress={openLandmark}
          openLandmarkId={landmarkId}
          liveTrains={visibleTrains}
          waitingFor={waitingFor}
          selectedTrainId={trainId}
          onTrainPress={(id) => {
            setLandmarkId(null);
            setTrainId(id);
          }}
        />

        {/* top-left stack: stop info first, XP bar underneath */}
        <View style={styles.topStack} pointerEvents="none">
          {info && (
            <View style={styles.distBadge}>
              <Text style={styles.distLabel}>{isNearest ? 'NEAREST STOP' : 'SELECTED STOP'}</Text>
              <Text style={styles.distName}>{info.station.name.toUpperCase()}</Text>
              {isNearest ? (
                <Text style={styles.distSub}>
                  {info.exact ? '' : '~'}
                  {formatDistance(info.meters)} walk · {info.walkMinutes} min
                </Text>
              ) : (
                <>
                  <Text style={styles.distSub}>
                    🚶 {formatDistance(info.straightMeters)} straight-line away
                  </Text>
                  {ride ? (
                    <Text style={styles.distSub}>
                      🚆 {ride.stops} stops · {formatDistance(ride.meters)} · ~{ride.minutes} min
                    </Text>
                  ) : null}
                  {totalMin ? <Text style={styles.distSub}>Total ~{totalMin} min</Text> : null}
                </>
              )}
            </View>
          )}

          <View style={styles.xpBar}>
            <Text style={styles.xpLevel}>LV {progress.level}</Text>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${(progress.xpIntoLevel / progress.xpForLevel) * 100}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.zoom}>
          <ZoomButton label="+" onPress={() => mapRef.current?.zoomIn()} />
          <ZoomButton label="-" onPress={() => mapRef.current?.zoomOut()} />
          <ZoomButton label="[]" onPress={() => mapRef.current?.reset()} />
        </View>

        {!selected && !landmark && !train && <StartHint />}

        {train && (
          <TrainCard
            train={train}
            onGoToStop={placeAt}
            onClose={() => setTrainId(null)}
            onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
          />
        )}

        {landmark && !train && (
          <LandmarkCard
            landmark={landmark}
            discovered={!!discovered[landmark.id]}
            atNearestStop={selectedId === landmark.nearestStop}
            onGo={() => placeAt(landmark.nearestStop)}
            onClose={() => setLandmarkId(null)}
            onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
          />
        )}

        {selected && !landmark && !train && (
          <StationCard
            key={selected.id} // a new stop opens as the short peek card again
            station={selected}
            previousId={trip.previousId}
            activeSignId={activeSignId}
            arrivals={arrivals}
            watchedId={watched?.id}
            onWatch={setWatchId}
            onSelect={rideTo}
            onClose={() => placeAt(null)}
            onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
          />
        )}

        {/* the avatar menu button steps aside while a card is open, to leave more map visible */}
        {!cardOpen && <GameMenu avatar={avatar} bottom={CARD_BOTTOM} onOpen={setScreen} />}

        {screen === 'customize' && (
          <CustomizeScreen avatar={avatar} onSave={setAvatar} onClose={() => setScreen(null)} />
        )}
        {screen === 'places' && (
          <PlacesScreen
            discovered={discovered}
            onShow={(id) => {
              setScreen(null);
              openLandmark(id);
            }}
            onClose={() => setScreen(null)}
          />
        )}
        {screen === 'friends' && player && (
          <LeaderboardScreen
            player={player}
            xp={progress.xp}
            found={progress.found}
            setName={setName}
            addFriend={addFriend}
            removeFriend={removeFriend}
            onClose={() => setScreen(null)}
          />
        )}
        {screen === 'settings' && <ComingSoonScreen id={screen} onClose={() => setScreen(null)} />}

        {discoveryQueue.length > 0 && (
          <DiscoveryPopup
            key={discoveryQueue[0]}
            landmark={landmarksById[discoveryQueue[0]]}
            remaining={discoveryQueue.length - 1}
            onClose={() => setDiscoveryQueue((q) => q.slice(1))}
          />
        )}
        {showTeapotGame && (
          <TeapotGame
            level={progress.level}
            onWin={(earnedXP) => {
              progress.addMinigameXP(earnedXP);
            }}
            onClose={() => setShowTeapotGame(false)}
          />
        )}
        {lobsterOpen && (
          <LobsterGame
            level={progress.level}
            onWin={(earnedXP) => {
              progress.addMinigameXP(earnedXP);
            }}
            onClose={() => setLobsterOpen(false)}
          />
        )}
        {duckOpen && (
          <DuckGame
            level={progress.level}
            avatar={avatar}
            onWin={(earnedXP) => {
              progress.addMinigameXP(earnedXP);
            }}
            onClose={() => setDuckOpen(false)}
            // renderHead={(size) => <AvatarSprite avatar={avatar} size={size} />}
          />
        )}
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

function ZoomButton({ label, onPress }) {
  return (
    <Pressable
      onPress={() => {
        playSfx('click');
        onPress();
      }}
      style={({ pressed }) => [styles.zoomBtn, pressed ? styles.zoomBtnPressed : styles.zoomBtnUp]}
    >
      <Text style={styles.zoomText}>{label}</Text>
    </Pressable>
  );
}

/** "● LIVE 49" in the header while live trains are coming in; grey when the MBTA can't be reached. */
function LiveBadge({ status, count }) {
  const live = status === 'live';
  return (
    <View style={styles.liveBadge}>
      <Text style={[styles.liveDot, { color: live ? '#ff5d5d' : '#8f98b5' }]}>●</Text>
      <Text style={styles.liveText}>{live ? `LIVE ${count}` : status === 'loading' ? '...' : 'OFFLINE'}</Text>
    </View>
  );
}

/** Blinking "press start" prompt shown until the rider picks a stop. */
function StartHint() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 600);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.hint} pointerEvents="none">
      <Text style={[styles.hintText, !on && { opacity: 0 }]}>▶ TAP A STOP TO START</Text>
      <Text style={styles.hintSub}>pinch or scroll to zoom · drag to pan</Text>
    </View>
  );
}

const isWeb = Platform.OS === 'web';
const TOP = isWeb ? 16 : 56; // header
const CARD_BOTTOM = 16; // matches StationCard's bottom offset
const SIGN_ROOM = 96; // extra space kept below a junction stop for its signposts
const NEARBY_M = 1500; // trains within this many meters of your stop stay on the map

const styles = StyleSheet.create({
  // On the web, show the app inside a phone-sized frame; on devices it fills the screen.
  page: {
    flex: 1,
    backgroundColor: isWeb ? '#14141f' : PALETTE.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: isWeb
    ? { width: 390, height: 844, maxHeight: '100%', borderRadius: 28, overflow: 'hidden', borderWidth: 8, borderColor: '#000' }
    : { flex: 1, alignSelf: 'stretch' },
  header: {
    position: 'absolute',
    top: isWeb ? 16 : 56,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.night,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    boxShadow: `4px 4px 0px ${PALETTE.ink}`,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
  },
  // stop info box on top, XP bar underneath
  topStack: {
    position: 'absolute',
    top: TOP,
    left: 14,
    right: 72, // stop short of the zoom buttons
    gap: 8,
  },
  xpBar: {
    alignSelf: 'flex-start',
    width: 200,
    backgroundColor: PALETTE.night,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    boxShadow: `4px 4px 0px ${PALETTE.ink}`,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  xpLevel: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.gold },
  xpTrack: { height: 6, backgroundColor: PALETTE.ink, marginVertical: 3 },
  xpFill: { height: 6, backgroundColor: PALETTE.green },
  xpText: { fontFamily: FONT_BODY, fontSize: 15, color: '#b7c0d8' },
  distBadge: {
    backgroundColor: PALETTE.night,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    boxShadow: `4px 4px 0px ${PALETTE.ink}`,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  distLabel: { fontFamily: FONT_TITLE, fontSize: 7, color: PALETTE.gold },
  distName: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white, marginTop: 4 },
  distSub: { fontFamily: FONT_BODY, fontSize: 17, color: '#b7c0d8' },
  lineBadge: {
    backgroundColor: PALETTE.green,
    borderWidth: 2,
    borderColor: PALETTE.greenLight,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBadgeText: { fontFamily: FONT_TITLE, fontSize: 9, color: PALETTE.white },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  liveDot: { fontSize: 10 },
  liveText: { fontFamily: FONT_TITLE, fontSize: 8, color: PALETTE.white },
  title: { fontFamily: FONT_TITLE, fontSize: 11, color: PALETTE.white },
  zoom: { position: 'absolute', right: 16, top: isWeb ? 16 : 56, gap: 10 },
  zoomBtn: {
    width: 40,
    height: 40,
    backgroundColor: PALETTE.white,
    borderWidth: 3,
    borderColor: PALETTE.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnUp: { boxShadow: `3px 3px 0px ${PALETTE.ink}` },
  zoomBtnPressed: { transform: [{ translateX: 3 }, { translateY: 3 }], backgroundColor: PALETTE.gold },
  zoomText: { fontFamily: FONT_TITLE, fontSize: 12, color: PALETTE.ink },
  hint: {
    position: 'absolute',
    left: 14,
    right: 92, // leave room for the avatar menu button
    bottom: CARD_BOTTOM,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PALETTE.night,
    borderWidth: 3,
    borderColor: PALETTE.panelEdge,
    boxShadow: `4px 4px 0px ${PALETTE.ink}`,
    paddingVertical: 10,
  },
  hintText: { fontFamily: FONT_TITLE, fontSize: 10, color: PALETTE.gold },
  hintSub: { fontFamily: FONT_BODY, fontSize: 17, color: '#b7c0d8', marginTop: 4 },
});
