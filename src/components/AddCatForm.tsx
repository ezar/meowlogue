import { useRef, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n';
import { MAX_NAME_LENGTH, nextCatColorId, validateCatName, type NameProblem } from '@/db/household';
import { downscalePhoto } from '@/lib/image';
import { ColorPicker } from './ColorPicker';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface Props {
  /** The household as it stands, for duplicate names and taken colours. */
  readonly cats: readonly { readonly name: string; readonly color: string }[];
  readonly onAdd: (cat: { name: string; color: string; photo?: Blob }) => Promise<void>;
  /** Distinguishes the ids when two forms could ever share a page. */
  readonly idPrefix?: string;
}

/** Maps a validation problem onto the message the user reads. */
const PROBLEM_MESSAGE: Record<NameProblem, MessageKey> = {
  empty: 'onboarding.error.empty',
  'too-long': 'onboarding.error.tooLong',
  duplicate: 'onboarding.error.duplicate',
};

/**
 * The add-a-cat form: name, accent colour, optional photo.
 *
 * Shared by onboarding and the household screen. It was onboarding's alone
 * until the household screen needed the same four rules — the name validation,
 * the next free colour, the photo downscale and the disabled-while-writing
 * behaviour — and a second copy of those would have drifted.
 */
export function AddCatForm({ cats, onAdd, idPrefix = 'cat' }: Props) {
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

  const nameId = `${idPrefix}-name`;
  const photoId = `${idPrefix}-photo`;
  const errorId = `${idPrefix}-name-error`;

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

  return (
    <section className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-stone-200">
      <div>
        <label htmlFor={nameId} className="block text-sm font-medium text-stone-800">
          {t('onboarding.cats.nameLabel')}
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          // Disabled while saving: `handleAdd` clears the field when the write
          // resolves, so text typed during the write would be wiped. The write
          // is a local IndexedDB put, so this is imperceptible.
          disabled={busy}
          maxLength={MAX_NAME_LENGTH + 1}
          placeholder={t('onboarding.cats.namePlaceholder')}
          aria-invalid={problem !== null}
          aria-describedby={problem === null ? undefined : errorId}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          className="mt-1.5 w-full rounded-lg bg-stone-50 px-3 py-2.5 text-base text-stone-900 ring-1 ring-stone-300 placeholder:text-stone-400 aria-invalid:ring-rose-400"
        />
        {problem !== null && (
          <p id={errorId} role="alert" className="mt-1.5 text-sm text-rose-700">
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
            id={photoId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              void handlePhoto(event.target.files?.[0]);
            }}
          />
          <label
            htmlFor={photoId}
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
  );
}
