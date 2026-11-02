import { ArrowRight, Sparkles } from 'lucide-react';
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
            <ul className="flex flex-wrap gap-1 rounded-full border border-brand/25 bg-white p-1 dark:border-brand/40 dark:bg-gray-800">
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
                                    'flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors',
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

/** Pasek nad szablonem: informacja, ze to przyklad, przelacznik szablonow i CTA zakupu. */
function ExampleBanner({
    current,
    ctaHref,
}: {
    current: PremiumTemplate;
    ctaHref: ProfileHref;
}): ReactElement {
    const t = useTranslations('ServiceProfile.example');

    return (
        <section
            aria-labelledby="example-heading"
            className="border-b border-brand/25 bg-gradient-to-br from-brand/10 via-white to-white dark:border-brand/40 dark:from-brand/20 dark:via-gray-900 dark:to-gray-900"
        >
            <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                <div className="max-w-2xl">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand dark:text-pink-300">
                        <Sparkles size={14} aria-hidden="true" />
                        {t('eyebrow')}
                    </p>
                    <h2
                        id="example-heading"
                        className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 md:text-2xl"
                    >
                        {t('title')}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                        {t('description')}
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <TemplateSwitcher current={current} />
                    <Link
                        href={ctaHref}
                        className={cn(
                            'flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition-all',
                            'hover:bg-brand/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                        )}
                    >
                        {t('cta')}
                        <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </section>
    );
}

/**
 * Przykladowa strona premium: pasek z informacja o przykladzie i wybrany szablon z fikcyjna
 * firma. `h1` zostaje w szablonie (nazwa firmy, jak na prawdziwym profilu), pasek ma `h2`.
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
