'use client';

import { hasLocale, useLocale, useTranslations } from 'next-intl';
import type { JSX } from 'react';

import type { LocalizedText } from '@/lib/add-business/draft-schema';
import { LANGUAGE_CODES } from '@/lib/add-business/form-limits';
import { type Category, CATEGORY_DEFINITIONS } from '@/lib/categories';
import type { Coverage } from '@/lib/coverage';

interface GeneratedSummaryProps {
    category: Category;
    coverage: Coverage;
    tags: LocalizedText[];
}

/**
 * Kategoria, zasieg i tagi jako TEKST, bez kontrolek formularza (R9): ustala je szkic
 * w Redisie, a submit i tak ich nie czyta. Wlasciciel komentuje je w polu uwag.
 */
export function GeneratedSummary({ category, coverage, tags }: GeneratedSummaryProps): JSX.Element {
    const t = useTranslations('addBusiness');
    const tCategories = useTranslations('MapPage.Categories');
    const locale = useLocale();
    const language = hasLocale(LANGUAGE_CODES, locale) ? locale : 'pl';

    return (
        <section
            aria-labelledby="add-business-generated-heading"
            className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
        >
            <h3
                id="add-business-generated-heading"
                className="text-base font-semibold text-gray-900 dark:text-gray-100"
            >
                {t('editor.generatedHeading')}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-gray-600 dark:text-gray-400">
                    {t('editor.category')}
                </dt>
                <dd className="text-gray-900 dark:text-gray-100">
                    {tCategories(CATEGORY_DEFINITIONS[category].text)}
                </dd>
                <dt className="font-medium text-gray-600 dark:text-gray-400">
                    {t('editor.coverage')}
                </dt>
                <dd className="text-gray-900 dark:text-gray-100">{t(`coverage.${coverage}`)}</dd>
                <dt className="font-medium text-gray-600 dark:text-gray-400">{t('editor.tags')}</dt>
                <dd className="text-gray-900 dark:text-gray-100">
                    {tags.map(tag => tag[language]).join(', ')}
                </dd>
            </dl>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('editor.generatedNote')}</p>
        </section>
    );
}
