// Live Green Line data from the MBTA V3 API (https://api-v3.mbta.com).
// Works without a key (20 requests/minute); set EXPO_PUBLIC_MBTA_API_KEY in a
// .env file for a higher limit (free key: https://api-v3.mbta.com/register).
import { useEffect, useRef, useState } from 'react';

import { project } from '../data/project';
import { MBTA_STOP_IDS, OUR_STOP_ID } from './mbtaStops';

const API = 'https://api-v3.mbta.com';
const ROUTES = 'Green-B,Green-C,Green-D,Green-E';
const API_KEY = process.env.EXPO_PUBLIC_MBTA_API_KEY;
export const POLL_MS = 12000; // vehicle positions refresh (5 requests/minute)
const ARRIVALS_MS = 30000; // stop arrivals refresh while a stop card is open

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: API_KEY ? { 'x-api-key': API_KEY } : {} });
  if (!res.ok) throw new Error(res.status === 429 ? 'rate-limited' : `HTTP ${res.status}`);
  return res.json();
}

const branchOf = (routeId) => routeId?.replace('Green-', '') ?? '?';
const includedById = (json) => Object.fromEntries((json.included ?? []).map((r) => [`${r.type}:${r.id}`, r.attributes]));
const includedResources = (json) => Object.fromEntries((json.included ?? []).map((r) => [`${r.type}:${r.id}`, r]));

/**
 * Live Green Line trains, refreshed every POLL_MS. Each train keeps its previous
 * position so the map can glide it to the new one:
 *   { id, branch, headsign, status, stopName, stopId, label, bearing, from: {x,y}, to: {x,y}, receivedAt, updatedAt }
 * stopId is our station id for the stop the train is at / heading to (when known).
 * status: 'live' | 'loading' | 'error' | 'rate-limited'
 */
export function useLiveTrains(enabled = true) {
  const [state, setState] = useState({ trains: [], status: 'loading' });
  const prev = useRef({});

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const json = await get(
          `/vehicles?filter[route]=${ROUTES}&include=stop,trip` +
            '&fields[vehicle]=latitude,longitude,bearing,current_status,updated_at,label' +
            '&fields[trip]=headsign&fields[stop]=name',
        );
        if (cancelled) return;
        const inc = includedById(json);
        const res = includedResources(json);
        const now = Date.now();
        const trains = json.data
          .filter((v) => v.attributes.latitude != null)
          .map((v) => {
            const a = v.attributes;
            const to = project(a.latitude, a.longitude);
            const old = prev.current[v.id];
            const stop = res[`stop:${v.relationships.stop?.data?.id}`];
            const parent = stop?.relationships?.parent_station?.data?.id;
            return {
              id: v.id,
              branch: branchOf(v.relationships.route?.data?.id),
              headsign: inc[`trip:${v.relationships.trip?.data?.id}`]?.headsign ?? '',
              stopName: stop?.attributes?.name ?? '',
              stopId: OUR_STOP_ID[parent] ?? null,
              status: a.current_status,
              label: a.label,
              bearing: a.bearing,
              updatedAt: a.updated_at,
              // glide from where it was last drawn; new trains just appear
              from: old ? old.to : to,
              to,
              receivedAt: now,
            };
          });
        prev.current = Object.fromEntries(trains.map((t) => [t.id, t]));
        setState({ trains, status: 'live' });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, status: e.message === 'rate-limited' ? 'rate-limited' : 'error' }));
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  return state;
}

/**
 * Next arrivals at one of our stations: [{ id, branch, headsign, minutes, vehicleId }], soonest first.
 * vehicleId matches a train id from useLiveTrains (null if no train is assigned yet).
 * Refreshes every ARRIVALS_MS while stationId is set.
 */
export function useArrivals(stationId) {
  const [state, setState] = useState({ arrivals: [], status: 'idle' });
  useEffect(() => {
    const stop = stationId && MBTA_STOP_IDS[stationId];
    if (!stop) {
      setState({ arrivals: [], status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setState({ arrivals: [], status: 'loading' });
    const load = async () => {
      try {
        const json = await get(
          `/predictions?filter[stop]=${stop}&filter[route]=${ROUTES}&include=trip` +
            '&fields[prediction]=arrival_time,departure_time&fields[trip]=headsign&sort=arrival_time&page[limit]=12',
        );
        if (cancelled) return;
        const inc = includedById(json);
        const now = Date.now();
        const arrivals = json.data
          .map((p) => {
            const when = p.attributes.arrival_time ?? p.attributes.departure_time;
            return {
              id: p.id,
              branch: branchOf(p.relationships.route?.data?.id),
              headsign: inc[`trip:${p.relationships.trip?.data?.id}`]?.headsign ?? '',
              minutes: when ? Math.round((new Date(when).getTime() - now) / 60000) : null,
              vehicleId: p.relationships.vehicle?.data?.id ?? null,
            };
          })
          .filter((a) => a.minutes != null && a.minutes >= 0) // skipped trips have no time
          .sort((a, b) => a.minutes - b.minutes)
          .slice(0, 4);
        setState({ arrivals, status: 'live' });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, status: e.message === 'rate-limited' ? 'rate-limited' : 'error' }));
      }
    };
    load();
    const id = setInterval(load, ARRIVALS_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [stationId]);
  return state;
}
