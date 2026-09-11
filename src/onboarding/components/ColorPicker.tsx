import { CAT_COLORS } from '@/lib/cat-colors';
import { useI18n, type MessageKey } from '@/i18n';

interface Props {
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  /** Colours already taken, shown as such rather than hidden. */
  readonly takenIds?: readonly string[];
}

/**
 * The eight cat accents (spec section 10).
 *
 * A radio group rather than a row of buttons, so arrow keys work and a screen
 * reader announces the colour's name — the selection is never conveyed by
 * colour alone (spec section 10 accessibility).
 */
export function ColorPicker({ selectedId, onSelect, takenIds = [] }: Props) {
  const { t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={t('onboarding.cats.colorLabel')}
      className="flex flex-wrap gap-2"
    >
      {CAT_COLORS.map((color) => {
        const selected = color.id === selectedId;
        const taken = takenIds.includes(color.id) && !selected;
        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={
              taken
                ? `${t(color.nameKey as MessageKey)} — ${t('onboarding.cats.colorTaken')}`
                : t(color.nameKey as MessageKey)
            }
            onClick={() => {
              onSelect(color.id);
            }}
            // A taken colour keeps its true hue and gets an inset ring
            // instead. Dimming it was the first attempt and it lied: the
            // swatch for "honey" went pale cream while the cat wearing it
            // showed dark honey, so the picker and the list disagreed about
            // the same colour.
            className={`size-10 rounded-full ring-offset-2 transition-[box-shadow] ${
              selected ? 'ring-2 ring-stone-900' : 'ring-1 ring-black/10'
            } ${taken ? 'inset-ring-3 inset-ring-white/80' : ''}`}
            style={{ backgroundColor: color.hex }}
          >
            {selected && (
              <span aria-hidden="true" className="block text-sm font-bold text-white">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
