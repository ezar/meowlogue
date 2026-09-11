import { useLiveQuery } from 'dexie-react-hooks';
import { isOnboardingComplete } from '@/db/household';
import { I18nProvider } from '@/i18n/I18nProvider';
import { Onboarding } from '@/onboarding/Onboarding';
import { DebugPage } from './debug/DebugPage';

/**
 * Routes between onboarding and the rest of the app.
 *
 * The choice is made by a persisted flag, not by whether the household has
 * cats. Watching the cat count looked equivalent and was not: adding the first
 * cat flipped the condition and threw the user out of onboarding before they
 * could add a second one. The end-to-end test caught it.
 *
 * No router yet: there are two destinations. A real router arrives with M1's
 * Listen, Timeline and Insights screens, which is when paths start earning
 * their keep.
 */
function Shell() {
  const completed = useLiveQuery(() => isOnboardingComplete(), [], null);

  // Null until Dexie answers. Rendering onboarding meanwhile would flash it at
  // someone who finished it long ago.
  if (completed === null) return null;
  if (!completed) return <Onboarding />;

  return <DebugPage />;
}

export function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
