import { useI18n, type MessageKey } from '@/i18n';
import { catColorById } from '@/lib/cat-colors';
import type { Cat } from '@/db/schema';
import { AddCatForm } from '@/components/AddCatForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { StepShell } from './components/StepShell';

interface Props {
  readonly step: number;
  readonly totalSteps: number;
  readonly cats: readonly Cat[];
  readonly onAdd: (cat: { name: string; color: string; photo?: Blob }) => Promise<void>;
  readonly onRemove: (catId: string) => Promise<void>;
  readonly onFinish: () => void;
}

/**
 * The household setup step (spec section 5.1).
 *
 * Two cats are what makes identity meaningful, but one is allowed and the copy
 * says plainly what is lost — the alternative would be blocking someone with
 * one cat out of a product that still logs, charts and summarises perfectly
 * well for them.
 *
 * The form itself lives in `AddCatForm`, shared with the household screen.
 */
export function AddCatsStep({ step, totalSteps, cats, onAdd, onRemove, onFinish }: Props) {
  const { t } = useI18n();
  const countLabel = cats.length === 1 ? 'onboarding.cats.countOne' : 'onboarding.cats.count';

  return (
    <StepShell
      step={step}
      totalSteps={totalSteps}
      title={t('onboarding.cats.title')}
      footer={
        <>
          <PrimaryButton onClick={onFinish} disabled={cats.length === 0}>
            {t('onboarding.cats.finish')}
          </PrimaryButton>
          {cats.length === 1 && (
            <p className="text-sm leading-relaxed text-stone-600">
              {t('onboarding.cats.oneCatNote')}
            </p>
          )}
        </>
      }
    >
      <p className="text-sm leading-relaxed text-stone-600">{t('onboarding.cats.subtitle')}</p>

      <div className="mt-5">
        <AddCatForm cats={cats} onAdd={onAdd} />
      </div>

      <section className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500 tabular-nums">
          {cats.length} {t(countLabel)}
        </p>
        {cats.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{t('onboarding.cats.empty')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {cats.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-stone-200"
              >
                <span
                  aria-hidden="true"
                  className="size-8 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: catColorById(cat.color).hex }}
                />
                <span className="flex-1 text-base text-stone-900">{cat.name}</span>
                {/* The colour is named in text as well: never colour alone. */}
                <span className="text-xs text-stone-500">
                  {t(catColorById(cat.color).nameKey as MessageKey)}
                </span>
                <SecondaryButton
                  className="px-2 py-1 text-sm"
                  onClick={() => void onRemove(cat.id)}
                >
                  {t('onboarding.cats.remove')}
                </SecondaryButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StepShell>
  );
}
