import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { PremiumPurchase } from '@/lib/premium-checkout-fields';
import { premiumContactQuery } from '@/lib/premium-contact';
import { PREMIUM_GALLERY_MAX, PREMIUM_TEMPLATES } from '@/lib/premium-templates';
import { cn } from '@/lib/utilities';

import { UpgradeCta } from '../upgrade-cta/upgrade-cta';

type ProfileUpgradeCtaProps = {
    serviceId: string;
    slug: string;
    purchase: PremiumPurchase;
    className?: string;
};

/** Kolejnosc: najpierw to, co przynosi klientow (pozycja), potem wyglad strony, na koncu wyroznik. */
const BENEFIT_KEYS = [
    'benefitHigherPosition',
    'benefitPhotos',
    'benefitTemplates',
    'benefitPrices',
    'benefitRatings',
    'benefitNoCompetitors',
] as const;

const BENEFIT_VALUES = { max: PREMIUM_GALLERY_MAX, count: PREMIUM_TEMPLATES.length };

/** Przykladowa strona premium z fikcyjna firma (`/cennik/przyklad`) — pokazuje korzysci w praktyce. */
function ExamplePageLink(): ReactElement {
    const t = useTranslations('ServiceProfile.upgrade');
    return (
        <Link
            href="/pricing/example"
            className="mt-4 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:text-pink-300"
        >
            {t('exampleLink')}
            <ArrowRight size={14} aria-hidden="true" />
        </Link>
    );
}

/**
 * Platnosci online wylaczone: zamiast Checkout link do `/kontakt` z tematem premium i slugiem
 * firmy (formularz wypelnia z nich temat i wiadomosc). Premium wlacza operator po przelewie.
 */
function UpgradeContactLink({ slug }: { slug: string }): ReactElement {
    const t = useTranslations('ServiceProfile.upgrade');
    return (
        <div className="mt-6 flex flex-col gap-4">
            <Link
                href={{ pathname: '/contact', query: premiumContactQuery(slug) }}
                className={cn(
                    'flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-center text-sm font-semibold text-white shadow-md shadow-brand/25 transition-all',
                    'hover:bg-brand/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                )}
            >
                {t('cta')}
                <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                {t('contactNote')}
            </p>
        </div>
    );
}

/**
 * CTA ulepszenia — tylko na darmowym profilu (R4); szablony premium go nie maja (R10).
 * Zakup idzie z profilu wprost do Stripe Checkout (`UpgradeCta`), bez przystanku na `/cennik`;
 * bez konfiguracji Stripe — do formularza kontaktowego (`UpgradeContactLink`).
 */
export function ProfileUpgradeCta({
    serviceId,
    slug,
    purchase,
    className,
}: ProfileUpgradeCtaProps): ReactElement {
    const t = useTranslations('ServiceProfile.upgrade');

    return (
        <section
            aria-labelledby="upgrade-heading"
            className={cn(
                'relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/10 via-white to-white p-5 dark:border-brand/40 dark:from-brand/20 dark:via-gray-800 dark:to-gray-800 md:p-6',
                className,
            )}
        >
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand dark:text-pink-300">
                <Sparkles size={14} aria-hidden="true" />
                {t('eyebrow')}
            </p>
            <h2
                id="upgrade-heading"
                className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100"
            >
                {t('title')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {t('description')}
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
                {BENEFIT_KEYS.map(key => (
                    <li
                        key={key}
                        className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200"
                    >
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                            <Check size={12} strokeWidth={3} aria-hidden="true" />
                        </span>
                        {t(key, BENEFIT_VALUES)}
                    </li>
                ))}
            </ul>
            <ExamplePageLink />
            {purchase.kind === 'checkout' ? (
                <UpgradeCta serviceId={serviceId} action={purchase.action} className="mt-6" />
            ) : (
                <UpgradeContactLink slug={slug} />
            )}
        </section>
    );
}
