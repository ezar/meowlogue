import { IDENTITY_GATE } from '@/engine';
import type { Cat } from '@/db/schema';
import { useI18n } from '@/i18n';
import { catColorById } from '@/lib/cat-colors';
import { percent } from '@/lib/format';
import { useIdentityStore } from './state/useIdentityStore';
import { useIdentityTraining } from './useIdentityTraining';

interface Props {
  readonly cats: readonly Cat[];
}

/**
 * Enrollment status and the self-test (spec 5.2's Settings screen, spec 6.4).
 *
 * Spec 6.4 asks for the self-test to be shown as "voice recognition: 86% on
 * your own examples", and the wording is deliberate: it is accuracy on the
 * user's own confirmations, not a claim about cats in general, and saying so
 * is the difference between a number and a boast. Each cat's progress towards
 * ten examples sits next to it, because that is what a person can change.
 */
export function VoicesSection({ cats }: Props) {
  const { t } = useI18n();
  const summary = useIdentityStore((state) => state.summary);
  useIdentityTraining();

  const needed = IDENTITY_GATE.minExamplesPerCat;

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-stone-800">{t('identity.sectionTitle')}</h2>
      <ul className="space-y-2" aria-label={t('identity.voicesList')}>
        {cats.map((cat) => {
          const count = summary?.countsByCat[cat.id] ?? 0;
          const done = count >= needed;
          return (
            <li
              key={cat.id}
              className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-stone-200"
            >
              <span
                aria-hidden="true"
                className="size-4 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: catColorById(cat.color).hex }}
              />
              <span className="flex-1 text-sm font-medium text-stone-900">{cat.name}</span>
              <span className="text-sm tabular-nums text-stone-600">
                {done
                  ? t('identity.progressDone', { count })
                  : t('identity.progress', { count, needed })}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">
        {/* No self-test result is a state of its own, not a 0%: with fewer
            than two labelled cats there is nothing to cross-validate, and
            reporting that as "0% accurate" would be a lie about a measurement
            that never ran. */}
        {summary === null || summary.perCat.length < 2
          ? t('identity.selfTestPending')
          : t('identity.selfTest', { percent: percent(summary.accuracy) })}
      </p>
    </section>
  );
}
