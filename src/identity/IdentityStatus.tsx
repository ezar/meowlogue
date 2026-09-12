import { useI18n } from '@/i18n';
import { IDENTITY_GATE } from '@/engine';
import type { Cat } from '@/db/schema';
import { percent } from '@/lib/format';
import { useIdentityStore } from './state/useIdentityStore';

interface Props {
  readonly cats: readonly Cat[];
}

/**
 * What identity can and cannot do right now, in one sentence (spec 6.4).
 *
 * There is always a sentence. The state this replaces was a single fixed line
 * saying the app was still learning, which stayed on screen forever and told
 * the user nothing about what would change it. Every branch here says what is
 * missing: two more from Mia, or an accuracy that is not good enough yet, or
 * that it is finally working and how well.
 */
export function IdentityStatus({ cats }: Props) {
  const { t } = useI18n();
  const summary = useIdentityStore((state) => state.summary);
  const readiness = summary?.readiness;

  if (readiness === undefined) {
    return (
      <p className="rounded-xl bg-stone-100 p-3 text-sm leading-relaxed text-stone-700">
        {t('listen.learning', { needed: IDENTITY_GATE.minExamplesPerCat })}
      </p>
    );
  }

  if (readiness.kind === 'needs-cats') {
    return (
      <p className="rounded-xl bg-stone-100 p-3 text-sm leading-relaxed text-stone-700">
        {t('listen.learningOneCat')}
      </p>
    );
  }

  if (readiness.kind === 'active') {
    return (
      <p className="rounded-xl bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900">
        {t('identity.active', { percent: percent(readiness.accuracy) })}
      </p>
    );
  }

  if (readiness.kind === 'needs-accuracy') {
    return (
      <p className="rounded-xl bg-stone-100 p-3 text-sm leading-relaxed text-stone-700">
        {t('identity.needAccuracy', {
          percent: percent(readiness.accuracy),
          needed: percent(IDENTITY_GATE.minSelfTestAccuracy),
        })}
      </p>
    );
  }

  // Named, not counted: "4 from Mia" is something a person can go and do,
  // where "14 more examples" is a number with no address.
  const detail = Object.entries(readiness.missingByCat)
    .map(([catId, count]) =>
      t('identity.needExamplesOne', {
        count,
        name: cats.find((cat) => cat.id === catId)?.name ?? catId,
      }),
    )
    .join(', ');

  return (
    <div className="rounded-xl bg-stone-100 p-3 text-sm leading-relaxed text-stone-700">
      <p>{t('listen.learning', { needed: IDENTITY_GATE.minExamplesPerCat })}</p>
      <p className="mt-1 text-stone-600">{t('identity.needExamples', { detail })}</p>
    </div>
  );
}
