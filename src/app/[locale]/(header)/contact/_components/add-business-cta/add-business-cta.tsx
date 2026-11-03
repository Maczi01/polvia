import { ArrowRight, Check, Sparkles, Star } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { JSX, ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utilities';

/** Ta sama okladka co na przykladowej stronie (`/cennik/przyklad`). */
const PREMIUM_EXAMPLE_COVER = '/images/premium-example/office.webp';

/** Korzysci bierzemy z cennika (`Pricing.plans.*`), zeby obie strony mowily to samo. */
const FREE_FEATURE_KEYS = [
    'plans.free.features.1',
    'plans.free.features.2',
    'plans.free.features.3',
    'plans.free.features.6',
] as const;

const PREMIUM_FEATURE_KEYS = [
    'plans.essentials.features.basics',
    'plans.essentials.features.templates',
    'plans.essentials.features.coverGallery',
    'plans.essentials.features.priceListFaq',
    'plans.essentials.features.shortUrl',
    'plans.essentials.features.higherPosition',
    'plans.essentials.features.noSimilar',
] as const;

function FeatureList({ items }: { items: string[] }): JSX.Element {
    return (
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {items.map(item => (
                <li key={item} className="flex gap-2">
                    <Check
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400"
                    />
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

type PlanCardProps = {
    headingId: string;
    title: ReactNode;
    price: string;
    description: string;
    features: string[];
    action: ReactNode;
    /** Podglad nad naglowkiem karty (Premium: przykladowa strona). */
    media?: ReactNode;
    className?: string;
};

function PlanCard(props: PlanCardProps): JSX.Element {
    return (
        <article
            aria-labelledby={props.headingId}
            className={cn(
                'flex flex-col gap-4 rounded-xl border bg-white p-6 dark:bg-gray-900',
                props.className,
            )}
        >
            {props.media}
            <header className="space-y-1">
                <h3
                    id={props.headingId}
                    className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                    {props.title}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{props.price}</p>
            </header>
            <p className="text-sm text-gray-600 dark:text-gray-300">{props.description}</p>
            <FeatureList items={props.features} />
            <div className="mt-auto pt-2">{props.action}</div>
        </article>
    );
}

/**
 * Okladka przykladowej strony premium jako klikalny podglad. Zdjecie dekoracyjne (`alt=""`),
 * nazwe linku daje etykieta na zdjeciu.
 */
function PremiumExamplePreview({ label }: { label: string }): JSX.Element {
    return (
        <Link
            href="/pricing/example"
            className="group relative block aspect-[16/9] overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        >
            <Image
                src={PREMIUM_EXAMPLE_COVER}
                alt=""
                fill
                sizes="(min-width: 768px) 400px, 100vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-sm font-semibold text-white">
                {label}
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </span>
        </Link>
    );
}

/** Panel „Mam firme” na `/kontakt`: darmowy wpis z AI (glowna akcja) i strona Premium. */
export function AddBusinessCta(): JSX.Element {
    const t = useTranslations('addBusiness.cta');
    const tPricing = useTranslations('Pricing');

    return (
        <section aria-labelledby="add-business-cta-heading" className="space-y-6">
            <h2
                id="add-business-cta-heading"
                className="text-center text-2xl font-semibold text-gray-900 dark:text-gray-100"
            >
                {t('heading')}
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
                <PlanCard
                    headingId="add-business-free-heading"
                    title={t('freeTitle')}
                    price={tPricing('plans.free.price.monthly')}
                    description={t('description')}
                    features={FREE_FEATURE_KEYS.map(key => tPricing(key))}
                    className="border-green-600 ring-1 ring-green-600 dark:border-green-400 dark:ring-green-400"
                    action={
                        <Link
                            href="/add-business"
                            className={cn(
                                buttonVariants({ variant: 'exploreMap', size: 'lg' }),
                                'w-full gap-2 font-semibold',
                            )}
                        >
                            <Sparkles aria-hidden="true" />
                            {t('button')}
                        </Link>
                    }
                />
                <PlanCard
                    headingId="add-business-premium-heading"
                    title={
                        <>
                            <Star aria-hidden="true" className="size-5 text-orange-500" />
                            {t('premiumTitle')}
                        </>
                    }
                    price={`${tPricing('plans.essentials.price.monthly')}${tPricing('plans.essentials.per.monthly')}`}
                    description={t('premiumDescription')}
                    features={PREMIUM_FEATURE_KEYS.map(key => tPricing(key))}
                    media={<PremiumExamplePreview label={t('premiumExample')} />}
                    className="border-gray-200 dark:border-gray-700"
                    action={
                        <Link
                            href="/pricing"
                            className={cn(
                                buttonVariants({ variant: 'addBusiness', size: 'lg' }),
                                'w-full',
                            )}
                        >
                            {t('premiumButton')}
                        </Link>
                    }
                />
            </div>

            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                {t('premiumNote')}
            </p>
        </section>
    );
}
