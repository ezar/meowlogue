import { useI18n, type MessageKey } from '@/i18n';
import { PrimaryButton } from './components/PrimaryButton';
import { SecondaryButton } from './components/SecondaryButton';
import { StepShell } from './components/StepShell';

interface Props {
  readonly step: number;
  readonly totalSteps: number;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

/** The four claims, each of which the app actually keeps (spec section 2). */
const POINTS: readonly MessageKey[] = [
  'onboarding.privacy.mic',
  'onboarding.privacy.local',
  'onboarding.privacy.clips',
  'onboarding.privacy.models',
];

/**
 * Privacy in one screen (spec section 5.2).
 *
 * One screen, four sentences, no scrolling wall. Each line is a claim the
 * implementation honours: the microphone only runs while listening is on and
 * the page is visible, inference is local, clips expire per the retention
 * setting, and the only network requests are the one-time model downloads
 * — which is why `models:fetch` self-hosts them instead of using a CDN.
 */
export function PrivacyStep({ step, totalSteps, onNext, onBack }: Props) {
  const { t } = useI18n();

  return (
    <StepShell
      step={step}
      totalSteps={totalSteps}
      title={t('onboarding.privacy.title')}
      footer={
        <>
          <PrimaryButton onClick={onNext}>{t('onboarding.privacy.cta')}</PrimaryButton>
          <SecondaryButton onClick={onBack}>{t('onboarding.privacy.back')}</SecondaryButton>
        </>
      }
    >
      <ul className="space-y-3">
        {POINTS.map((point) => (
          <li key={point} className="flex gap-3 text-base leading-relaxed text-stone-700">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-stone-400" />
            <span>{t(point)}</span>
          </li>
        ))}
      </ul>
    </StepShell>
  );
}
