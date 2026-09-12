import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { readonly children: ReactNode };

/** The main action of a step. */
export function PrimaryButton({ children, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-xl bg-stone-900 px-5 py-3 text-base font-semibold text-white transition-opacity disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
