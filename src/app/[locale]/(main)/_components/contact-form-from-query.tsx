'use client';

import { useSearchParams } from 'next/navigation';
import type { ReactElement } from 'react';

import { readContactPrefill } from '@/lib/premium-contact';

import { ContactForm } from './contact-form';

/**
 * Formularz kontaktowy wypelniony z query (`?topic=premium&firma=<slug>` z „Przejdz na
 * Premium”). `useSearchParams` zamiast `searchParams` strony: `/kontakt` ma
 * `generateStaticParams` i zostaje statyczna. Strona owija go w `<Suspense>` z pustym
 * `ContactForm` jako fallbackiem, wiec statyczny HTML nadal ma formularz.
 */
export function ContactFormFromQuery(): ReactElement {
    const searchParams = useSearchParams();
    return <ContactForm prefill={readContactPrefill(searchParams)} />;
}
