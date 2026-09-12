import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  MAX_NAME_LENGTH,
  addCat,
  identityIsMeaningful,
  removeCat,
  renameCat,
  resetHousehold,
  setCatColor,
  type NameProblem,
} from '@/db/household';
import { db, type Cat } from '@/db/schema';
import { useI18n, type MessageKey } from '@/i18n';
import { catColorById } from '@/lib/cat-colors';
import { AddCatForm } from '@/components/AddCatForm';
import { DangerButton } from '@/components/DangerButton';
import { ColorPicker } from '@/components/ColorPicker';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { VoicesSection } from '@/identity/VoicesSection';

/** Maps a validation problem onto the message the user reads. */
const PROBLEM_MESSAGE: Record<NameProblem, MessageKey> = {
  empty: 'onboarding.error.empty',
  'too-long': 'onboarding.error.tooLong',
  duplicate: 'onboarding.error.duplicate',
};

/**
 * The household, after onboarding (spec section 5.2, the Settings screen).
 *
 * Onboarding could add cats and then closed behind you: a third cat, a
 * renamed one or a changed accent had no route in the UI at all, and clearing
 * the site data was the only way. This is that route.
 *
 * Starting over lives here too, behind a confirmation, because "let me reread
 * the explanation" and "delete my cats" must never be the same button.
 */
export function HouseholdScreen() {
  const { t } = useI18n();
  const cats = useLiveQuery(() => db.cats.orderBy('createdAt').toArray(), [], null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (cats === null) return null;

  const identity = identityIsMeaningful(cats.length);

  return (
    <ScreenShell title={t('household.title')}>
      <p className="text-sm leading-relaxed text-stone-600">{t('household.subtitle')}</p>

      <section className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500 tabular-nums">
          {cats.length}{' '}
          {t(cats.length === 1 ? 'onboarding.cats.countOne' : 'onboarding.cats.count')}
        </p>
        {cats.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{t('onboarding.cats.empty')}</p>
        ) : (
          // Named because the voices section below is a second list of the
          // same cats, and "the list of cats" has to mean one of them.
          <ul className="mt-2 space-y-2" aria-label={t('household.catsList')}>
            {cats.map((cat) => (
              <CatRow key={cat.id} cat={cat} others={cats.filter((one) => one.id !== cat.id)} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          {identity
            ? t('household.identityOn', { count: cats.length })
            : t('household.identityOff')}
        </p>
      </section>

      {identity && <VoicesSection cats={cats} />}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-800">{t('household.addTitle')}</h2>
        <AddCatForm
          cats={cats}
          idPrefix="household"
          onAdd={async (candidate) => {
            await addCat(candidate);
          }}
        />
      </section>

      <section className="mt-8 rounded-xl bg-rose-50 p-4 ring-1 ring-rose-200">
        <h2 className="text-sm font-semibold text-rose-900">{t('household.dangerTitle')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-rose-900/80">{t('household.dangerBody')}</p>
        {confirmingReset ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DangerButton confirming onClick={() => void resetHousehold()}>
              {t('household.dangerConfirm')}
            </DangerButton>
            <SecondaryButton
              onClick={() => {
                setConfirmingReset(false);
              }}
            >
              {t('household.dangerKeep')}
            </SecondaryButton>
          </div>
        ) : (
          <DangerButton
            className="mt-3"
            onClick={() => {
              setConfirmingReset(true);
            }}
          >
            {t('household.dangerCta')}
          </DangerButton>
        )}
      </section>
    </ScreenShell>
  );
}

interface RowProps {
  readonly cat: Cat;
  /** Every other cat, for the duplicate-name check and taken colours. */
  readonly others: readonly Cat[];
}

/** One cat: its accent, its name, and an editor for both. */
function CatRow({ cat, others }: RowProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [problem, setProblem] = useState<NameProblem | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  async function save(): Promise<void> {
    const found = await renameCat(cat.id, name);
    setProblem(found);
    if (found === null) setEditing(false);
  }

  if (!editing) {
    return (
      <li className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-stone-200">
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
          onClick={() => {
            setName(cat.name);
            setProblem(null);
            setEditing(true);
          }}
        >
          {t('household.edit')}
        </SecondaryButton>
      </li>
    );
  }

  const nameId = `edit-${cat.id}-name`;
  return (
    <li className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-stone-300">
      <div>
        <label htmlFor={nameId} className="block text-sm font-medium text-stone-800">
          {t('onboarding.cats.nameLabel')}
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH + 1}
          aria-invalid={problem !== null}
          aria-describedby={problem === null ? undefined : `${nameId}-error`}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          className="mt-1.5 w-full rounded-lg bg-stone-50 px-3 py-2.5 text-base text-stone-900 ring-1 ring-stone-300 aria-invalid:ring-rose-400"
        />
        {problem !== null && (
          <p id={`${nameId}-error`} role="alert" className="mt-1.5 text-sm text-rose-700">
            {t(PROBLEM_MESSAGE[problem])}
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-stone-800">
          {t('onboarding.cats.colorLabel')}
        </p>
        {/* Written straight through: a colour is one tap and undoing it is
            another, so a save button in between would only add ceremony. */}
        <ColorPicker
          selectedId={cat.color}
          takenIds={others.map((one) => one.color)}
          onSelect={(color) => {
            void setCatColor(cat.id, color);
          }}
        />
      </div>

      {confirmingRemove ? (
        <div className="space-y-2 rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200">
          {/* Named in the question: "remove" with two cats on screen is
              ambiguous, and this one cascades to the cat's labels. */}
          <p className="text-sm leading-relaxed text-rose-900">
            {t('household.removeConfirm', { name: cat.name })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <DangerButton confirming onClick={() => void removeCat(cat.id)}>
              {t('household.removeYes')}
            </DangerButton>
            <SecondaryButton
              onClick={() => {
                setConfirmingRemove(false);
              }}
            >
              {t('household.cancel')}
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton className="px-3 py-2 text-sm" onClick={() => void save()}>
            {t('household.save')}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              setEditing(false);
              setProblem(null);
            }}
          >
            {t('household.cancel')}
          </SecondaryButton>
          <DangerButton
            className="ml-auto"
            onClick={() => {
              setConfirmingRemove(true);
            }}
          >
            {t('onboarding.cats.remove')}
          </DangerButton>
        </div>
      )}
    </li>
  );
}
