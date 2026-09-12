import { useRef, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n';
import { MAX_NAME_LENGTH, nextCatColorId, validateCatName, type NameProblem } from '@/db/household';
import { catColorById } from '@/lib/cat-colors';
import { downscalePhoto } from '@/lib/image';
import type { Cat } from '@/db/schema';
import { ColorPicker } from './components/ColorPicker';
import { PrimaryButton } from './components/PrimaryButton';
import { SecondaryButton } from './components/SecondaryButton';
import { StepShell } from './components/StepShell';

interface Props {
  readonly step: number;
  readonly totalSteps: number;
  readonly cats: readonly Cat[];
  readonly onAdd: (cat: { name: string; color: string; photo?: Blob }) => Promise<void>;
  readonly onRemove: (catId: string) => Promise<void>;
  readonly onFinish: () => void;
}

/** Maps a validation problem onto the message the user reads. */
const PROBLEM_MESSAGE: Record<NameProblem, MessageKey> = {
  empty: 'onboarding.error.empty',
  'too-long': 'onboarding.error.tooLong',
  duplicate: 'onboarding.error.duplicate',
};

/**
 * The household setup step (spec section 5.1).
 *
 * Two cats are what makes identity meaningful, but one is allowed and the copy
 * says plainly what is lost — the alternative would be blocking someone with
 * one cat out of a product that still logs, charts and summarises perfectly
 * well for them.
 */
export function AddCatsStep({ step, totalSteps, cats, onAdd, onRemove, onFinish }: Props) {
  const { t } = useI18n();
  const usedColors = cats.map((cat) => cat.color);

  const [name, setName] = useState('');
  const [color, setColor] = useState(() => nextCatColorId(usedColors));
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<NameProblem | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function clearPhoto(): void {
    if (photoUrl !== null) URL.revokeObjectURL(photoUrl);
    setPhoto(null);
    setPhotoUrl(null);
    if (fileInput.current !== null) fileInput.current.value = '';
  }

  async function handlePhoto(file: File | undefined): Promise<void> {
    setPhotoError(false);
    if (file === undefined) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError(true);
      return;
    }
    // Downscale before anything else sees it, so the preview shows exactly
    // what will be stored and no full-resolution copy is held in state.
    setPhotoPending(true);
    try {
      const stored = await downscalePhoto(file);
      if (photoUrl !== null) URL.revokeObjectURL(photoUrl);
      setPhoto(stored);
      setPhotoUrl(URL.createObjectURL(stored));
    } finally {
      setPhotoPending(false);
    }
  }

  async function handleAdd(): Promise<void> {
    const found = validateCatName(
      name,
      cats.map((cat) => cat.name),
    );
    setProblem(found);
    if (found !== null) return;

    setBusy(true);
    try {
      await onAdd({ name: name.trim(), color, ...(photo === null ? {} : { photo }) });
      setName('');
      clearPhoto();
      setColor(nextCatColorId([...usedColors, color]));
    } finally {
      setBusy(false);
    }
  }

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

      <section className="mt-5 space-y-4 rounded-xl bg-white p-4 ring-1 ring-stone-200">
        <div>
          <label htmlFor="cat-name" className="block text-sm font-medium text-stone-800">
            {t('onboarding.cats.nameLabel')}
          </label>
          <input
            id="cat-name"
            type="text"
            value={name}
            // Disabled while saving: `handleAdd` clears the field when the
            // write resolves, so text typed during the write would be wiped.
            // The write is a local IndexedDB put, so this is imperceptible.
            disabled={busy}
            maxLength={MAX_NAME_LENGTH + 1}
            placeholder={t('onboarding.cats.namePlaceholder')}
            aria-invalid={problem !== null}
            aria-describedby={problem === null ? undefined : 'cat-name-error'}
            onChange={(event) => {
              setName(event.target.value);
              setProblem(null);
            }}
            className="mt-1.5 w-full rounded-lg bg-stone-50 px-3 py-2.5 text-base text-stone-900 ring-1 ring-stone-300 placeholder:text-stone-400 aria-invalid:ring-rose-400"
          />
          {problem !== null && (
            <p id="cat-name-error" role="alert" className="mt-1.5 text-sm text-rose-700">
              {t(PROBLEM_MESSAGE[problem])}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-800">
            {t('onboarding.cats.colorLabel')}
          </p>
          <ColorPicker selectedId={color} onSelect={setColor} takenIds={usedColors} />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-800">
            {t('onboarding.cats.photoLabel')}
          </p>
          <div className="flex items-center gap-3">
            {photoUrl !== null && (
              <img
                src={photoUrl}
                alt=""
                className="size-14 rounded-full object-cover ring-1 ring-black/10"
              />
            )}
            <input
              ref={fileInput}
              id="cat-photo"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                void handlePhoto(event.target.files?.[0]);
              }}
            />
            <label
              htmlFor="cat-photo"
              className="cursor-pointer rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-800"
            >
              {t('onboarding.cats.photoAdd')}
            </label>
            {photo !== null && (
              <SecondaryButton className="px-2 py-1 text-sm" onClick={clearPhoto}>
                {t('onboarding.cats.photoRemove')}
              </SecondaryButton>
            )}
          </div>
          {photoError && (
            <p role="alert" className="mt-1.5 text-sm text-rose-700">
              {t('onboarding.error.photo')}
            </p>
          )}
        </div>

        <PrimaryButton
          className="w-full"
          // Also disabled while a photo is being re-encoded: adding in that
          // window would save the cat without the photo just picked.
          disabled={busy || photoPending || name.trim().length === 0}
          onClick={() => void handleAdd()}
        >
          {t('onboarding.cats.add')}
        </PrimaryButton>
      </section>

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
