import type { IdentityGuess } from '@/engine';
import type { Cat } from '@/db/schema';
import { useI18n } from '@/i18n';
import { percent } from '@/lib/format';

interface Props {
  readonly guess: IdentityGuess | null;
  readonly cats: readonly Cat[];
  /** True once the user has answered; a guess is then beside the point. */
  readonly answered: boolean;
}

/**
 * What identity thinks about one event, in one sentence (spec 6.4).
 *
 * Never a bare name: above the "not sure" threshold it reads "I think that
 * was Luna" with the margin beside it, below it the sentence says outright
 * that it is not sure, and inside the active-learning band it adds why
 * confirming this one matters. Shared by the Listen card and the event detail
 * so the same guess cannot be worded two ways.
 */
export function GuessLine({ guess, cats, answered }: Props) {
  const { t } = useI18n();
  if (guess === null || answered) return null;

  const cat = cats.find((one) => one.id === guess.catId);
  if (cat === undefined) return null;

  return (
    <div>
      <p className={`text-sm ${guess.notSure ? 'text-stone-600' : 'text-stone-900'}`}>
        {t(guess.notSure ? 'identity.guessUnsure' : 'identity.guess', {
          name: cat.name,
          percent: percent(guess.confidence),
        })}
      </p>
      {guess.askAgain && <p className="text-xs text-amber-800">{t('identity.helpful')}</p>}
    </div>
  );
}
