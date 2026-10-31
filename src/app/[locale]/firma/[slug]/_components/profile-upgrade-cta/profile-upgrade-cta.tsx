import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { PREMIUM_GALLERY_MAX } from '@/lib/premium-templates';
import { cn } from '@/lib/utilities';

import type { ProfileHref } from '../service-profile-types';

type ProfileUpgradeCtaProps = {
    href: ProfileHref;
    className?: string;
};

const BENEFIT_KEYS = ['benefitPhotos', 'benefitPrices', 'benefitNoCompetitors'] as const;

/** CTA ulepszenia — tylko na darmowym profilu (R4); szablony premium go nie maja (R10). */
export function ProfileUpgradeCta({ href, className }: ProfileUpgradeCtaProps): ReactElement {
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
                    <li key={key} className="flex items-start gap-2.5 text-sm text-gray-800 dark:text-gray-200">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                            <Check size={12} strokeWidth={3} aria-hidden="true" />
                        </span>
                        {t(key, { max: PREMIUM_GALLERY_MAX })}
                    </li>
                ))}
            </ul>
            <Link
                href={href}
                className={cn(
                    'mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-center text-sm font-semibold text-white shadow-md shadow-brand/25 transition-all',
                    'hover:bg-brand/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                )}
            >
                {t('cta')}
                <ArrowRight size={16} aria-hidden="true" />
            </Link>
        </section>
    );
}
