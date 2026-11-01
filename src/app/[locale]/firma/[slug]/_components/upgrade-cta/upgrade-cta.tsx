'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, type ReactElement, startTransition, useActionState, useId } from 'react';

import {
    type CheckoutAction,
    PREMIUM_INTERVALS,
    type PremiumInterval,
} from '@/lib/premium-checkout-fields';
import { DEFAULT_PREMIUM_INTERVAL } from '@/lib/premium-plan';
import { cn } from '@/lib/utilities';

type UpgradeCtaProps = {
    serviceId: string;
    /** `startPremiumCheckout` z `_actions.ts` — wstrzykiwana, zeby Storybook i testy nie ciagnely Stripe. */
    action: CheckoutAction;
    className?: string;
};

/**
 * Jedna opcja interwalu: natywne radio (sr-only) + karta z nazwa i cena. Kwota z tych samych
 * kluczy co `/cennik` (`Pricing.plans.essentials`) — zmiana ceny to jedna edycja tlumaczen.
 */
function IntervalOption({ interval }: { interval: PremiumInterval }): ReactElement {
    const t = useTranslations('ServiceProfile.checkout');
    const tPlan = useTranslations('Pricing.plans.essentials');
    return (
        <label className="relative block cursor-pointer">
            <input
                type="radio"
                name="interval"
                value={interval}
                defaultChecked={interval === DEFAULT_PREMIUM_INTERVAL}
                className="peer sr-only"
            />
            <span
                className={cn(
                    'flex h-full flex-col gap-0.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-colors dark:border-gray-600 dark:bg-gray-800',
                    'peer-checked:border-brand peer-checked:bg-brand/5 peer-checked:ring-1 peer-checked:ring-brand dark:peer-checked:bg-brand/20',
                    'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2',
                )}
            >
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t(interval)}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                    {tPlan(`price.${interval}`)} {tPlan(`per.${interval}`)}
                </span>
                {interval === 'yearly' && (
                    <span className="mt-1 self-start rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                        {t('yearlySaving')}
                    </span>
                )}
            </span>
        </label>
    );
}

function CheckoutSubmit({ isPending }: { isPending: boolean }): ReactElement {
    const t = useTranslations('ServiceProfile');
    return (
        <button
            type="submit"
            disabled={isPending}
            className={cn(
                'flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-center text-sm font-semibold text-white shadow-md shadow-brand/25 transition-all',
                'hover:bg-brand/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                'disabled:cursor-wait disabled:opacity-70',
            )}
        >
            {isPending ? t('checkout.pending') : t('upgrade.cta')}
            {!isPending && <ArrowRight size={16} aria-hidden="true" />}
        </button>
    );
}

/**
 * Zakup premium z darmowego profilu (R4, R14): wybor interwalu i przejscie do Stripe Checkout.
 * Formularz wysyla tylko `serviceId` i interwal — cene wybiera serwer z allowlisty env.
 * Sukces akcji to przekierowanie, wiec komponent pokazuje wylacznie blad.
 */
export function UpgradeCta({ serviceId, action, className }: UpgradeCtaProps): ReactElement {
    const t = useTranslations('ServiceProfile');
    const [state, formAction, isPending] = useActionState(action, null);
    const errorId = useId();
    const error = state?.error ?? null;

    // `onSubmit` zamiast `action`: React 19 resetuje pola po akcji z propsu `action`,
    // a po bledzie wybrany interwal ma zostac.
    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (isPending) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
    }

    return (
        <form onSubmit={handleSubmit} className={cn('flex flex-col gap-4', className)}>
            <input type="hidden" name="serviceId" value={serviceId} />
            <fieldset aria-describedby={error ? errorId : undefined}>
                <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t('checkout.legend')}
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    {PREMIUM_INTERVALS.map(interval => (
                        <IntervalOption key={interval} interval={interval} />
                    ))}
                </div>
            </fieldset>

            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                    {error.message}
                </p>
            )}

            <CheckoutSubmit isPending={isPending} />
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                {t('checkout.note')}
            </p>
        </form>
    );
}
