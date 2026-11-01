'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, type ReactElement, startTransition, useActionState, useId } from 'react';

import { Textarea } from '@/components/ui/textarea';
import {
    type MaterialsAction,
    type MaterialsFieldErrors,
    PREMIUM_MATERIALS_MAX_LENGTH,
    PREMIUM_MATERIALS_TEXT_FIELDS,
    type PremiumMaterialsTextField,
} from '@/lib/premium-checkout-fields';
import { PREMIUM_TEMPLATES } from '@/lib/premium-templates';
import { cn } from '@/lib/utilities';

type PremiumMaterialsFormProps = {
    /** Id oplaconej sesji Checkout — akcja weryfikuje ja w Stripe ponownie. */
    sessionId: string;
    slug: string;
    /** `submitPremiumMaterials` z `_actions.ts` — wstrzykiwana, zeby test nie ciagnal Stripe. */
    action: MaterialsAction;
};

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

/** `aria-describedby` z identyfikatorow elementow, ktore faktycznie sa w DOM-ie. */
function describedBy(...ids: (string | null)[]): string | undefined {
    const present = ids.filter(id => id !== null);
    return present.length > 0 ? present.join(' ') : undefined;
}

function FieldError({ id, message }: { id: string; message: string }): ReactElement {
    return (
        <p id={id} className="text-sm text-red-700 dark:text-red-400">
            {message}
        </p>
    );
}

function TemplateField({ error }: { error: string | undefined }): ReactElement {
    const t = useTranslations('ServiceProfile.materials');
    const errorId = useId();

    return (
        <fieldset aria-describedby={describedBy(error ? errorId : null)} className="space-y-2">
            <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('templateLegend')}
            </legend>
            {PREMIUM_TEMPLATES.map(template => (
                <label
                    key={template}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 has-[:checked]:border-brand dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                    <input
                        type="radio"
                        name="template"
                        value={template}
                        className={cn('size-4 accent-brand', FOCUS_RING)}
                    />
                    {t(`templates.${template}`)}
                </label>
            ))}
            {error && <FieldError id={errorId} message={error} />}
        </fieldset>
    );
}

function TextField({
    name,
    error,
}: {
    name: PremiumMaterialsTextField;
    error: string | undefined;
}): ReactElement {
    const t = useTranslations('ServiceProfile.materials');
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t(name)}{' '}
                <span className="font-normal text-gray-500 dark:text-gray-400">
                    {t('optional')}
                </span>
            </label>
            <p id={hintId} className="text-sm text-gray-600 dark:text-gray-400">
                {t(`${name}Hint`)}
            </p>
            <Textarea
                id={id}
                name={name}
                rows={name === 'notes' ? 3 : 5}
                maxLength={PREMIUM_MATERIALS_MAX_LENGTH[name]}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(hintId, error ? errorId : null)}
                className={cn(
                    'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100',
                    error ? 'border-red-400' : 'border-gray-200 dark:border-gray-600',
                    FOCUS_RING,
                )}
            />
            {error && <FieldError id={errorId} message={error} />}
        </div>
    );
}

function SuccessNotice(): ReactElement {
    const t = useTranslations('ServiceProfile.materials');
    return (
        <p className="flex items-start gap-2 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
            <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            {t('success')}
        </p>
    );
}

function MaterialsSubmit({ isPending }: { isPending: boolean }): ReactElement {
    const t = useTranslations('ServiceProfile.materials');
    return (
        <button
            type="submit"
            aria-disabled={isPending}
            className={cn(
                'flex min-h-11 w-full items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand/90 aria-disabled:cursor-wait aria-disabled:opacity-70 sm:w-auto',
                FOCUS_RING,
            )}
        >
            {isPending ? t('pending') : t('submit')}
        </button>
    );
}

/**
 * Formularz materialow strony premium (R16): szablon i tekst, bez uploadu — zdjecia ida
 * mailem. Wynik akcji trafia do regionu `aria-live`; po sukcesie formularz znika.
 * `onSubmit` zamiast `action`: React 19 czysci pola po akcji z propsu `action`,
 * a po bledzie walidacji uzytkownik nie moze stracic wpisanego cennika.
 */
export function PremiumMaterialsForm({
    sessionId,
    slug,
    action,
}: PremiumMaterialsFormProps): ReactElement {
    const [state, formAction, isPending] = useActionState(action, null);
    const isSent = state !== null && 'data' in state;
    const error = state !== null && 'error' in state ? state.error : null;
    const fields: MaterialsFieldErrors = error?.fields ?? {};

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (isPending) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
    }

    return (
        <div className="space-y-5">
            <div aria-live="polite">
                {isSent && <SuccessNotice />}
                {error && (
                    <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                        {error.message}
                    </p>
                )}
            </div>
            {!isSent && (
                <form noValidate onSubmit={handleSubmit} className="space-y-6">
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <input type="hidden" name="slug" value={slug} />
                    <TemplateField error={fields.template} />
                    {PREMIUM_MATERIALS_TEXT_FIELDS.map(name => (
                        <TextField key={name} name={name} error={fields[name]} />
                    ))}
                    <MaterialsSubmit isPending={isPending} />
                </form>
            )}
        </div>
    );
}
