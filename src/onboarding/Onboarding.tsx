import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addCat, markOnboardingComplete, removeCat } from '@/db/household';
import { db, type Cat } from '@/db/schema';
import { AddCatsStep } from './AddCatsStep';
import { PrivacyStep } from './PrivacyStep';
import { WelcomeStep } from './WelcomeStep';

/** The three onboarding steps (spec section 5.2). */
type Step = 'welcome' | 'privacy' | 'cats';

const ORDER: readonly Step[] = ['welcome', 'privacy', 'cats'];

/**
 * Onboarding: welcome, privacy, add cats.
 *
 * The cat list comes from Dexie through a live query rather than local state,
 * so a cat added here is already persisted — reloading mid-onboarding does not
 * lose it, and the step that follows reads the same source of truth.
 */
export function Onboarding() {
  const cats = useLiveQuery(() => db.cats.orderBy('createdAt').toArray(), [], null);

  // Null until Dexie answers. Rendering the welcome step meanwhile would flash
  // it at someone who is resuming with cats already added.
  if (cats === null) return null;

  return <OnboardingSteps cats={cats} />;
}

interface StepsProps {
  readonly cats: readonly Cat[];
}

/**
 * The steps themselves, mounted only once the household is known.
 *
 * Split out so the first step can be chosen in a lazy `useState` initialiser
 * rather than an effect: setting state from an effect triggers a cascading
 * render, and React's lint rule says so.
 *
 * Someone who already added a cat resumes at that step instead of walking
 * welcome and privacy again. That matters more than it sounds — the household
 * the spec is built around has two cats, so the gap between adding the first
 * and the second is exactly where a reload is likely to land.
 */
function OnboardingSteps({ cats }: StepsProps) {
  const [step, setStep] = useState<Step>(() => (cats.length > 0 ? 'cats' : 'welcome'));
  const position = ORDER.indexOf(step) + 1;

  switch (step) {
    case 'welcome':
      return (
        <WelcomeStep
          step={position}
          totalSteps={ORDER.length}
          onNext={() => {
            setStep('privacy');
          }}
        />
      );
    case 'privacy':
      return (
        <PrivacyStep
          step={position}
          totalSteps={ORDER.length}
          onNext={() => {
            setStep('cats');
          }}
          onBack={() => {
            setStep('welcome');
          }}
        />
      );
    case 'cats':
      return (
        <AddCatsStep
          step={position}
          totalSteps={ORDER.length}
          cats={cats}
          onAdd={async (candidate) => {
            await addCat(candidate);
          }}
          onRemove={async (catId) => {
            await removeCat(catId);
          }}
          onFinish={() => {
            // Persisted, so a reload does not drop the user back in here.
            void markOnboardingComplete();
          }}
        />
      );
  }
}
