import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentType, ReactElement } from 'react';

import type {
    PremiumProfileView,
    ProfileHref,
} from '@/app/[locale]/firma/[slug]/_components/service-profile-types';
import { TemplateClassic } from '@/app/[locale]/firma/[slug]/_components/template-classic/template-classic';
import { TemplateGallery } from '@/app/[locale]/firma/[slug]/_components/template-gallery/template-gallery';
import { TemplateProfessional } from '@/app/[locale]/firma/[slug]/_components/template-professional/template-professional';
import { Link } from '@/i18n/navigation';
import { PREMIUM_TEMPLATES, type PremiumTemplate } from '@/lib/premium-templates';
import { cn } from '@/lib/utilities';

import { EXAMPLE_TEMPLATE_PARAM } from '../premium-example-profile';

/** Te same komponenty co na profilu `/firma/<slug>` — przyklad pokazuje prawdziwe szablony. */
const TEMPLATE_COMPONENTS: Record<
    PremiumTemplate,
    ComponentType<{ profile: PremiumProfileView }>
> = {
    gallery: TemplateGallery,
    professional: TemplateProfessional,
    classic: TemplateClassic,
};

type PremiumExampleProps = {
    profile: PremiumProfileView;
    /** Zakup premium: `/cennik` przy platnosciach online, inaczej `/kontakt?topic=premium`. */
    ctaHref: ProfileHref;
};

/** Przelacznik szablonow: zwykle linki z `?szablon=`, biezacy oznaczony `aria-current`. */
function TemplateSwitcher({ current }: { current: PremiumTemplate }): ReactElement {
    const t = useTranslations('ServiceProfile.example');

    return (
        <nav aria-label={t('switcherLabel')}>
            <ul className="flex flex-wrap gap-1 rounded-full border border-brand/25 bg-white/70 p-1 dark:border-brand/40 dark:bg-gray-800/70">
                {PREMIUM_TEMPLATES.map(template => {
                    const isCurrent = template === current;
                    return (
                        <li key={template}>
                            <Link
                                href={{
                                    pathname: '/pricing/example',
                                    query: { [EXAMPLE_TEMPLATE_PARAM]: template },
                                }}
                                aria-current={isCurrent ? 'page' : undefined}
                                className={cn(
                                    'flex min-h-9 items-center rounded-full px-3 text-xs font-semibold transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                                    isCurrent
                                        ? 'bg-brand text-white shadow-sm'
                                        : 'text-gray-700 hover:bg-brand/10 dark:text-gray-200 dark:hover:bg-brand/20',
                                )}
                            >
                                {t(`templates.${template}`)}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/**
 * Plywajaca karta po prawej (desktop: u gory, pod naglowkiem; telefon: na dole): informacja, ze to przyklad, przelacznik szablonow
 * i CTA zakupu. Polprzezroczysta i zwijana (`<details>`, bez JS), zeby nie zaslaniac strony.
 */
function ExampleBanner({
    current,
    ctaHref,
}: {
    current: PremiumTemplate;
    ctaHref: ProfileHref;
}): ReactElement {
    const t = useTranslations('ServiceProfile.example');

    return (
        <aside
            aria-labelledby="example-heading"
            className="fixed inset-x-4 bottom-4 z-40 sm:bottom-auto sm:left-auto sm:top-24 sm:w-80"
        >
            <details
                open
                className="group rounded-2xl border border-brand/25 bg-white/75 shadow-xl shadow-brand/10 backdrop-blur-md dark:border-brand/40 dark:bg-gray-900/75"
            >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand dark:text-pink-300">
                        <Sparkles size={14} aria-hidden="true" />
                        {t('eyebrow')}
                    </span>
                    <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                    />
                </summary>
                <div className="space-y-3 px-4 pb-4">
                    {/* Na telefonie tylko dla czytnikow: karta ma byc niska, etykieta wyzej mowi juz, ze to przyklad. */}
                    <h2
                        id="example-heading"
                        className="sr-only text-base font-bold leading-snug text-gray-900 dark:text-gray-100 sm:not-sr-only"
                    >
                        {t('title')}
                    </h2>
                    <p className="sr-only text-xs leading-5 text-gray-600 dark:text-gray-300 sm:not-sr-only">
                        {t('description')}
                    </p>
                    <TemplateSwitcher current={current} />
                    <Link
                        href={ctaHref}
                        className={cn(
                            'flex min-h-10 items-center justify-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/25 transition-all',
                            'hover:bg-brand/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                        )}
                    >
                        {t('cta')}
                        <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </div>
            </details>
        </aside>
    );
}

/**
 * Przykladowa strona premium: pasek z informacja o przykladzie i wybrany szablon z fikcyjna
 * firma. `h1` zostaje w szablonie (nazwa firmy, jak na prawdziwym profilu), karta ma `h2`.
 */
export function PremiumExample({ profile, ctaHref }: PremiumExampleProps): ReactElement {
    const current = profile.premium.template;
    const Template = TEMPLATE_COMPONENTS[current];

    return (
        <>
            <ExampleBanner current={current} ctaHref={ctaHref} />
            <Template profile={profile} />
        </>
    );
}
