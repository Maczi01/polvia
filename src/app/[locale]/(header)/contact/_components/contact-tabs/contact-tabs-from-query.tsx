'use client';

import { useSearchParams } from 'next/navigation';
import type { JSX, ReactNode } from 'react';

import { ContactForm } from '@/app/[locale]/(main)/_components/contact-form';
import { readContactPrefill } from '@/lib/premium-contact';

import { readContactTab } from '../../contact-tab';
import { ContactTabs } from './contact-tabs';

/**
 * Zakladka i wypelnienie formularza z query (`?tab=pytanie`, `?topic=premium&firma=<slug>`).
 * `useSearchParams` zamiast `searchParams` strony: `/kontakt` ma `generateStaticParams`
 * i zostaje statyczna. Strona owija go w `<Suspense>` z `ContactTabs` na zakladce
 * domyslnej jako fallbackiem, wiec statyczny HTML ma oba panele.
 */
export function ContactTabsFromQuery({ business }: { business: ReactNode }): JSX.Element {
    const searchParams = useSearchParams();

    return (
        <ContactTabs
            defaultTab={readContactTab(searchParams)}
            business={business}
            question={<ContactForm prefill={readContactPrefill(searchParams)} />}
        />
    );
}
