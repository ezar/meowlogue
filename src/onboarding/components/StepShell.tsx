import type { ReactNode } from 'react';
import { useI18n } from '@/i18n';

interface Props {
  /** 1-based position of this step. */
  readonly step: number;
  readonly totalSteps: number;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}

/**
 * Shared frame for an onboarding step: progress, heading, body, actions.
 *
 * The progress line is text, not a bar, because it has to survive being read
 * by a screen reader and at 130% dynamic type (spec section 10).
 */
export function StepShell({ step, totalSteps, title, children, footer }: Props) {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500 tabular-nums">
        {t('onboarding.step', { current: step, total: totalSteps })}
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight text-stone-900">{title}</h1>
      <div className="mt-5 flex-1">{children}</div>
      <div className="mt-8 flex flex-col gap-2">{footer}</div>
    </main>
  );
}
