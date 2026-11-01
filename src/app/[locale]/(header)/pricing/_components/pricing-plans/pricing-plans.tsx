'use client';

import { ArrowRight, Check, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactElement, type ReactNode, useId, useState } from 'react';

import { Link } from '@/i18n/navigation';
import { PREMIUM_INTERVALS, type PremiumInterval } from '@/lib/premium-checkout-fields';
import { premiumContactQuery } from '@/lib/premium-contact';
import { DEFAULT_PREMIUM_INTERVAL } from '@/lib/premium-plan';
import { cn } from '@/lib/utilities';

type PlanId = 'free' | 'essentials' | 'team';

type PlanHref = '/add-business' | '/map' | '/contact';

/** Kolejnosc cech planu darmowego: najpierw widocznosc, potem dane wpisu. */
const FREE_FEATURE_KEYS = ['5', '0', '1', '2', '3', '4', '6'] as const;

/** Tylko to, co dostarcza premium (R7–R12) — bez obietnic, ktorych produkt nie spelnia. */
export const ESSENTIALS_FEATURE_KEYS = [
    'basics',
    'templates',
    'coverGallery',
    'priceListFaq',
    'noSimilar',
    'shortUrl',
    'higherPosition',
] as const;

const TEAM_FEATURE_KEYS = ['0', '1', '2', '3', '4'] as const;

type PlanConfig = {
    id: PlanId;
    href: PlanHref;
    featureKeys: readonly string[];
    /** Plan bez cennika (kontakt) nie zalezy od okresu rozliczenia. */
    hasPeriodPrice: boolean;
    isRecommended: boolean;
};

const PLANS: readonly PlanConfig[] = [
    {
        id: 'free',
        href: '/add-business',
        featureKeys: FREE_FEATURE_KEYS,
        hasPeriodPrice: true,
        isRecommended: false,
    },
    {
        id: 'essentials',
        href: '/map',
        featureKeys: ESSENTIALS_FEATURE_KEYS,
        hasPeriodPrice: true,
        isRecommended: true,
    },
    {
        id: 'team',
        href: '/contact',
        featureKeys: TEAM_FEATURE_KEYS,
        hasPeriodPrice: false,
        isRecommended: false,
    },
];

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';

/**
 * Jak sprzedajemy premium — decyduje serwer (`isStripeConfigured`). `checkout`: zakup z profilu
 * firmy przez Stripe + logowanie do portalu klienta (`STRIPE_PORTAL_LOGIN_URL`). `contact`:
 * platnosci online wylaczone, plan prowadzi do formularza kontaktowego (premium reczne).
 */
export type PricingPurchase = { kind: 'checkout'; portalUrl: string } | { kind: 'contact' };

type PricingPlansProps = {
    /** Naglowek strony renderowany przez Server Component — przelacznik okresu stoi obok niego. */
    heading: ReactNode;
    purchase: PricingPurchase;
};

export function PricingPlans({ heading, purchase }: PricingPlansProps): ReactElement {
    const t = useTranslations('Pricing');
    const [selectedInterval, setSelectedInterval] =
        useState<PremiumInterval>(DEFAULT_PREMIUM_INTERVAL);

    return (
        <>
            <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                {heading}
                <div role="group" aria-label={t('billingLegend')} className="flex gap-4">
                    {PREMIUM_INTERVALS.map(option => (
                        <PeriodButton
                            key={option}
                            isActive={selectedInterval === option}
                            onSelect={() => setSelectedInterval(option)}
                        >
                            {t(option)}
                        </PeriodButton>
                    ))}
                </div>
            </header>

            <div className="my-1 grid grid-cols-1 gap-6 md:grid-cols-3">
                {PLANS.map(plan => (
                    <PriceCard
                        key={plan.id}
                        plan={plan}
                        interval={selectedInterval}
                        purchase={purchase}
                    />
                ))}
            </div>
        </>
    );
}

type PeriodButtonProps = {
    isActive: boolean;
    onSelect: () => void;
    children: ReactNode;
};

function PeriodButton({ isActive, onSelect, children }: PeriodButtonProps): ReactElement {
    return (
        <button
            type="button"
            aria-pressed={isActive}
            onClick={onSelect}
            className={cn(
                'rounded-full border px-4 py-2 font-sans text-sm transition-colors',
                FOCUS_RING,
                isActive
                    ? 'border-transparent bg-green text-white dark:bg-green dark:text-white'
                    : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
            )}
        >
            {children}
        </button>
    );
}

type PriceCardProps = {
    plan: PlanConfig;
    interval: PremiumInterval;
    purchase: PricingPurchase;
};

type CardLink = {
    href: PlanHref | { pathname: '/contact'; query: Record<string, string> };
    ctaKey: string;
};

/** Plan premium bez Stripe prowadzi do kontaktu z tematem premium zamiast na mape. */
function cardLink(plan: PlanConfig, purchase: PricingPurchase): CardLink {
    if (plan.id === 'essentials' && purchase.kind === 'contact') {
        return { href: { pathname: '/contact', query: premiumContactQuery() }, ctaKey: 'contactCta' };
    }
    return { href: plan.href, ctaKey: 'cta' };
}

function PriceCard({ plan, interval, purchase }: PriceCardProps): ReactElement {
    const t = useTranslations('Pricing');
    const titleId = useId();
    const instructionId = useId();
    const key = (name: string): string => `plans.${plan.id}.${name}`;
    const isEssentials = plan.id === 'essentials';
    const link = cardLink(plan, purchase);

    return (
        <article
            aria-labelledby={titleId}
            className={cn(
                'min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800',
                plan.isRecommended && 'ring-2 ring-green dark:ring-green',
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <h2 id={titleId} className="font-sans text-sm font-medium text-gray-600 dark:text-gray-400">
                        {t(key('title'))}
                    </h2>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="font-sans text-5xl font-extrabold text-[#26364d] dark:text-white">
                            {plan.hasPeriodPrice ? t(key(`price.${interval}`)) : t(key('price'))}
                        </span>
                        {plan.hasPeriodPrice && (
                            <span className="font-sans text-lg text-gray-500 dark:text-gray-400">
                                {t(key(`per.${interval}`))}
                            </span>
                        )}
                    </div>
                    <p className="mt-2 font-sans text-sm text-gray-500 dark:text-gray-400">
                        {t(key('subtitle'))}
                    </p>
                </div>
                {plan.isRecommended && (
                    <span className="inline-block rounded-md bg-green px-2 py-1 font-sans text-xs font-semibold text-white">
                        {t('recommended')}
                    </span>
                )}
            </div>

            <div className="mt-6">
                <Link
                    href={link.href}
                    aria-describedby={isEssentials ? instructionId : undefined}
                    className={cn(
                        'inline-flex items-center gap-2 rounded-full px-6 py-3 font-sans font-medium text-white shadow-sm',
                        FOCUS_RING,
                        plan.isRecommended ? 'bg-green' : 'bg-[#26364d] dark:bg-gray-700',
                    )}
                >
                    {t(key(link.ctaKey))}
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                {isEssentials && (
                    <EssentialsHelp instructionId={instructionId} purchase={purchase} />
                )}
            </div>

            <div className="mt-6">
                <h3 className="font-sans text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('whatsIncluded')}
                </h3>
                <ul className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    {plan.featureKeys.map(featureKey => (
                        <li key={featureKey} className="flex items-start gap-3">
                            <Check className="mt-0.5 size-4 shrink-0 text-green" aria-hidden="true" />
                            <span className="font-sans">{t(key(`features.${featureKey}`))}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </article>
    );
}

type EssentialsHelpProps = {
    instructionId: string;
    purchase: PricingPurchase;
};

/**
 * Zakup idzie z profilu konkretnej firmy (R14), wiec plan pokazuje, jak tam trafic. Bez Stripe:
 * „napisz do nas — aktywujemy w 1 dzien roboczy”, bez portalu subskrypcji (nie ma subskrypcji).
 */
function EssentialsHelp({ instructionId, purchase }: EssentialsHelpProps): ReactElement {
    const t = useTranslations('Pricing');
    if (purchase.kind === 'contact') {
        return (
            <p id={instructionId} className="mt-3 font-sans text-sm text-gray-600 dark:text-gray-400">
                {t('plans.essentials.contactInstruction')}
            </p>
        );
    }
    return (
        <>
            <p id={instructionId} className="mt-3 font-sans text-sm text-gray-600 dark:text-gray-400">
                {t('plans.essentials.instruction')}
            </p>
            <p className="mt-3 font-sans text-sm text-gray-600 dark:text-gray-400">
                {t('manageSubscriptionPrompt')}{' '}
                <a
                    href={purchase.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        'inline-flex items-center gap-1 rounded font-medium text-green-700 underline-offset-4 hover:underline dark:text-green-300',
                        FOCUS_RING,
                    )}
                >
                    {t('manageSubscription')}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">{t('opensInNewTab')}</span>
                </a>
            </p>
        </>
    );
}
