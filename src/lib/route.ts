import { useSyncExternalStore } from 'react';

/**
 * Where the app is.
 *
 * No router library: spec section 7 does not list one, and four destinations
 * decided by a hash do not need 20 kB of matching, params and loaders. The
 * hash is deliberate rather than lazy — it survives a reload, works on a
 * static host with no rewrite rules (GitHub Pages), and gives the phone's back
 * button something real to go back to.
 *
 * When Listen, Timeline and Insights arrive with their own nested state, this
 * is small enough to throw away in favour of a real router.
 */
export type Route = 'home' | 'household' | 'help';

const ROUTES: readonly Route[] = ['home', 'household', 'help'];

/**
 * Reads a route out of a location hash.
 *
 * Anything unrecognised is `home`: a stale or hand-typed hash should land
 * somewhere useful rather than on a blank screen.
 *
 * @param hash A `location.hash`, with or without its leading `#`.
 */
export function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return ROUTES.find((route) => route === name) ?? 'home';
}

/** The hash for a route, ready to assign to `location.hash`. */
export function hashFor(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

function currentRoute(): Route {
  return parseHash(window.location.hash);
}

/** The current route, re-rendering the caller when the hash changes. */
export function useRoute(): Route {
  // `useSyncExternalStore` rather than an effect: the hash can change between
  // render and commit (a back button press), and this is the hook that exists
  // to read an external source without tearing.
  return useSyncExternalStore(subscribe, currentRoute, () => 'home');
}

/** Navigates, leaving an entry in history so Back returns where it came from. */
export function navigate(route: Route): void {
  window.location.hash = hashFor(route);
}
