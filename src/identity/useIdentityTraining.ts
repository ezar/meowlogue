import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { useIdentityStore } from './state/useIdentityStore';

/**
 * Keeps the identity model in step with what the user has confirmed.
 *
 * Spec 6.4 retrains "whenever the set changes", and the set changes for two
 * reasons: a confirmation, or a cat arriving or leaving. Both are watched here
 * rather than in a callback on the confirm button, so a confirmation made
 * anywhere — this screen, the timeline, a future teach-voices flow — retrains
 * without that screen having to remember to.
 *
 * The two counts are indexed lookups, not scans: `confirmedAt` and the cats'
 * primary key both have indexes, so this costs nothing to keep watching.
 */
export function useIdentityTraining(): void {
  const retrain = useIdentityStore((state) => state.retrain);
  const confirmed = useLiveQuery(() => db.events.where('confirmedAt').above(0).count(), [], 0);
  const cats = useLiveQuery(() => db.cats.count(), [], 0);

  useEffect(() => {
    retrain();
  }, [confirmed, cats, retrain]);
}
