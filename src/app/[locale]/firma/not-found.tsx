'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';

/**
 * 404 profilu firmy, gdy `page.tsx` wywola `notFound()` (lookup w middleware zawiodl).
 * Zwykle 404 dla nieistniejacego slugu daje middleware — wtedy Next pokazuje globalne
 * not-found, nie ten plik.
 *
 * Komponent kliencki, bo `getTranslations()` w granicy `not-found` nie ma
 * gwarantowanego kontekstu locale; `NextIntlClientProvider` z layoutu ma.
 */
export default function ServiceProfileNotFound(): ReactElement {
    const t = useTranslations('NotFound');

    return (
        <section className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-16 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                {t('profileHeading')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{t('profileDescription')}</p>
            <Link
                href="/map"
                className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                {t('backToMap')}
            </Link>
        </section>
    );
}
