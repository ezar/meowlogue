import { useLiveQuery } from 'dexie-react-hooks';
import { isOnboardingComplete } from '@/db/household';
import { I18nProvider } from '@/i18n/I18nProvider';
import { Onboarding } from '@/onboarding/Onboarding';
import { HouseholdScreen } from '@/household/HouseholdScreen';
import { HelpScreen } from '@/help/HelpScreen';
import { ListenScreen } from '@/listen/ListenScreen';
import { useRoute } from '@/lib/route';
import { DebugPage } from './debug/DebugPage';

/**
 * Routes between onboarding and the rest of the app.
 *
 * Whether onboarding is done is decided by a persisted flag, not by whether
 * the household has cats. Watching the cat count looked equivalent and was
 * not: adding the first cat flipped the condition and threw the user out of
 * onboarding before they could add a second one. The end-to-end test caught it.
 *
 * Everything after that is decided by the hash (`src/lib/route.ts`). No router
 * library: three destinations do not need one, and a hash works on a static
 * host with no rewrite rules. Onboarding deliberately ignores the hash — it
 * has its own linear flow, and landing mid-way through it from a stale
 * bookmark would be worse than starting at the beginning.
 */
function Shell() {
  const completed = useLiveQuery(() => isOnboardingComplete(), [], null);
  const route = useRoute();

  // Null until Dexie answers. Rendering onboarding meanwhile would flash it at
  // someone who finished it long ago.
  if (completed === null) return null;
  if (!completed) return <Onboarding />;

  switch (route) {
    case 'household':
      return <HouseholdScreen />;
    case 'help':
      return <HelpScreen />;
    case 'debug':
      return <DebugPage />;
    case 'home':
      // Listen is the main screen (spec 5.1). The debug page is still here at
      // `#/debug` because it is what tunes the thresholds against a real room.
      return <ListenScreen />;
  }
}

export function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
