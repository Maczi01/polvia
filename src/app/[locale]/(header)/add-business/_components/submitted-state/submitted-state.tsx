'use client';

import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

import { Link } from '@/i18n/navigation';
import type { FactField } from '@/lib/add-business/draft-schema';
import type { BusinessPreview, DraftPin } from '@/lib/add-business/types';

import { BusinessCardPreview } from '../business-card-preview/business-card-preview';
import { FlowHeading } from '../flow-heading/flow-heading';

interface SubmittedStateProps {
    card: BusinessPreview;
    unconfirmed: readonly FactField[];
    pin: DraftPin | null;
    logoSrc: string | null;
}

/** R15: podziekowanie + karta po edycji (tylko do odczytu) + informacja o mailu. */
export function SubmittedState({
    card,
    unconfirmed,
    pin,
    logoSrc,
}: SubmittedStateProps): JSX.Element {
    const t = useTranslations('addBusiness');
    const name = card.name ?? t('preview.namePlaceholder');

    return (
        <section aria-labelledby="add-business-submitted-heading" className="space-y-8">
            <div className="space-y-4 rounded-2xl bg-white/80 p-8 text-center shadow-2xl dark:bg-gray-800/90">
                <CircleCheck
                    aria-hidden
                    className="mx-auto size-12 text-green-600 dark:text-green-400"
                />
                <FlowHeading
                    id="add-business-submitted-heading"
                    shouldFocusOnMount
                    className="text-green-700 dark:text-green-400"
                >
                    {t('submitted.heading')}
                </FlowHeading>
                <p className="text-gray-700 dark:text-gray-300">{t('submitted.body', { name })}</p>
                <p className="text-gray-700 dark:text-gray-300">{t('submitted.emailNote')}</p>
            </div>

            <div className="mx-auto max-w-xl space-y-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {t('submitted.cardHeading')}
                </h3>
                <BusinessCardPreview
                    preview={card}
                    unconfirmed={unconfirmed}
                    logoSrc={logoSrc}
                    pin={pin}
                />
            </div>

            <p className="text-center">
                <Link
                    href="/"
                    className="font-medium text-green-700 underline underline-offset-4 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 dark:text-green-400"
                >
                    {t('submitted.backHome')}
                </Link>
            </p>
        </section>
    );
}
