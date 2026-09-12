import { useI18n } from '@/i18n';
import { PrimaryButton } from './components/PrimaryButton';
import { StepShell } from './components/StepShell';

interface Props {
  readonly step: number;
  readonly totalSteps: number;
  readonly onNext: () => void;
}

/**
 * Welcome (spec section 5.2).
 *
 * The copy states outright that Meowlogue does not translate. Getting that in
 * before anything else is the point: "cat translator" is the category this
 * will be mistaken for, and the honest framing is a product principle
 * (spec section 2), not a disclaimer to bury in an About page.
 */
export function WelcomeStep({ step, totalSteps, onNext }: Props) {
  const { t } = useI18n();

  return (
    <StepShell
      step={step}
      totalSteps={totalSteps}
      title={t('onboarding.welcome.title')}
      footer={<PrimaryButton onClick={onNext}>{t('onboarding.welcome.cta')}</PrimaryButton>}
    >
      <p className="text-base leading-relaxed text-stone-700">{t('onboarding.welcome.body')}</p>
    </StepShell>
  );
}
