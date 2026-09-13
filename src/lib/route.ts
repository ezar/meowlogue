import { useSyncExternalStore } from 'react';

/**
 * Where the app is.
 *
 * No router library: spec section 7 does not list one, and a handful of
 * destinations decided by a hash do not need 20 kB of matching, params and
 * loaders. The hash is deliberate rather than lazy — it survives a reload,
 * works on a static host with no rewrite rules (GitHub Pages), and gives the
 * phone's back button something real to go back to.
 *
 * A route is an object rather than a name because one destination carries
 * state: an event's detail is about *that* event, and putting its id in the
 * URL is what makes the back button close the detail, a reload keep it open,
 * and a shared link mean anything at all.
 */
export type Route =
  | { readonly kind: 'home' }
  | { readonly kind: 'timeline' }
  | { readonly kind: 'event'; readonly id: string }
  | { readonly kind: 'household' }
  | { readonly kind: 'help' }
  | { readonly kind: 'debug' };

/** Routes with no state of their own, by name. */
const SIMPLE = ['home', 'timeline', 'household', 'help', 'debug'] as const;

/** The home route, and the fallback for anything unrecognised. */
const HOME: Route = { kind: 'home' };

/**
 * Reads a route out of a location hash.
 *
 * Anything unrecognised is `home`: a stale or hand-typed hash should land
 * somewhere useful rather than on a blank screen. That includes
 * `#/event/` with no id, which is a link to nothing.
 *
 * @param hash A `location.hash`, with or without its leading `#`.
 */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [name, ...rest] = path.split('/');

  if (name === 'event') {
    // The id is whatever follows, re-joined and decoded: event ids are
    // generated, but a hand-edited URL should not be able to smuggle a path.
    const id = decodeURIComponent(rest.join('/'));
    return id === '' ? HOME : { kind: 'event', id };
  }

  const simple = SIMPLE.find((route) => route === name);
  return simple === undefined ? HOME : { kind: simple };
}

/** The hash for a route, ready to assign to `location.hash`. */
export function hashFor(route: Route): string {
  if (route.kind === 'home') return '#/';
  if (route.kind === 'event') return `#/event/${encodeURIComponent(route.id)}`;
  return `#/${route.kind}`;
}

/** True when two routes point at the same place. */
export function sameRoute(a: Route, b: Route): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'event' || a.id === (b as { readonly id: string }).id;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

/**
 * The current route object, cached so that `useSyncExternalStore` sees a
 * stable reference between hash changes.
 *
 * Without the cache `getSnapshot` would return a new object on every call and
 * React would re-render forever, which is the one way this hook can be got
 * wrong.
 */
let cached: Route = HOME;
let cachedHash: string | null = null;

function currentRoute(): Route {
  const hash = window.location.hash;
  if (hash !== cachedHash) {
    cachedHash = hash;
    cached = parseHash(hash);
  }
  return cached;
}

/** The current route, re-rendering the caller when the hash changes. */
export function useRoute(): Route {
  // `useSyncExternalStore` rather than an effect: the hash can change between
  // render and commit (a back button press), and this is the hook that exists
  // to read an external source without tearing.
  return useSyncExternalStore(subscribe, currentRoute, () => HOME);
}

/** Navigates, leaving an entry in history so Back returns where it came from. */
export function navigate(route: Route): void {
  window.location.hash = hashFor(route);
}
