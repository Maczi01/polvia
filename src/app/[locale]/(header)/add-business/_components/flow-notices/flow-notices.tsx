'use client';

import { CircleAlert } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type JSX, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { Link } from '@/i18n/navigation';
import type { ActionErrorCode } from '@/lib/add-business/types';

import { FlowHeading } from '../flow-heading/flow-heading';

const LINK_CLASSES =
    'font-medium text-green-700 underline underline-offset-4 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 dark:text-green-400';

const PANEL_CLASSES =
    'space-y-4 rounded-xl bg-white/80 p-6 shadow-xl ring-1 ring-gray-100 dark:bg-gray-800/90 dark:ring-gray-700';

/** Kody, po ktorych ponowienie nic nie da — zostaje kontakt z nami. */
const CONTACT_CODES: ReadonlySet<ActionErrorCode> = new Set<ActionErrorCode>([
    'INVALID_ENTRY',
    'SEND_FAILED',
    'INTERNAL',
]);

/** Blad akcji: tlumaczony WYLACZNIE kod — `message` z serwera jest techniczny. */
export function ActionErrorNotice({ code }: { code: ActionErrorCode }): JSX.Element {
    const t = useTranslations('addBusiness');
    return (
        <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
        >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
                {t(`actionErrors.${code}`)}
                {CONTACT_CODES.has(code) && (
                    <>
                        {' '}
                        <Link href="/contact" className={LINK_CLASSES}>
                            {t('notice.contactLink')}
                        </Link>
                    </>
                )}
            </p>
        </div>
    );
}

interface DuplicateNoticeProps {
    name: string;
    slug: string;
    onStartOver: () => void;
}

/** R7: firma juz jest w katalogu — link do wpisu zamiast generowania. */
export function DuplicateNotice({ name, slug, onStartOver }: DuplicateNoticeProps): JSX.Element {
    const t = useTranslations('addBusiness');
    return (
        <section aria-labelledby="add-business-duplicate-heading" className={PANEL_CLASSES}>
            <FlowHeading id="add-business-duplicate-heading" shouldFocusOnMount>
                {t('duplicate.heading')}
            </FlowHeading>
            <p className="text-gray-700 dark:text-gray-300">{t('duplicate.body', { name })}</p>
            <p>
                <Link href={{ pathname: '/map', query: { place: slug } }} className={LINK_CLASSES}>
                    {t('duplicate.link', { name })}
                </Link>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('duplicate.hint')}{' '}
                <Link href="/contact" className={LINK_CLASSES}>
                    {t('notice.contactLink')}
                </Link>
            </p>
            <Button type="button" variant="outline" onClick={onStartOver} className="border px-4">
                {t('duplicate.startOver')}
            </Button>
        </section>
    );
}

/** R16: limit generowan — kiedy znow mozna i droga przez formularz kontaktowy. */
export function LimitedNotice({ retryAfter }: { retryAfter: number }): JSX.Element {
    const t = useTranslations('addBusiness.limited');
    const format = useFormatter();
    // Chwila wejscia na ekran, nie kazdy render — inaczej tekst „za 5 godzin" plywalby.
    const [now] = useState(() => new Date());
    const when = format.relativeTime(new Date(now.getTime() + retryAfter * 1000), now);

    return (
        <section aria-labelledby="add-business-limited-heading" className={PANEL_CLASSES}>
            <FlowHeading id="add-business-limited-heading" shouldFocusOnMount>
                {t('heading')}
            </FlowHeading>
            <p className="text-gray-700 dark:text-gray-300">{t('body', { when })}</p>
            <p>
                <Link href="/contact" className={LINK_CLASSES}>
                    {t('contact')}
                </Link>
            </p>
        </section>
    );
}
