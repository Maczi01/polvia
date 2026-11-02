'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { Building2, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX, ReactNode } from 'react';

import type { ContactTab } from '../../contact-tab';

const TRIGGER_CLASS =
    'flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ' +
    'text-gray-600 transition-colors hover:text-gray-900 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ' +
    'data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow ' +
    'dark:text-gray-300 dark:hover:text-white ' +
    'dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-green-400 sm:text-base';

const CONTENT_CLASS =
    'mt-8 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600';

type ContactTabsProps = {
    defaultTab: ContactTab;
    /** Panel „Mam firme” renderuje serwer i przekazuje gotowy. */
    business: ReactNode;
    question: ReactNode;
};

/** Przelacznik „Mam firme” / „Mam pytanie” na `/kontakt`. */
export function ContactTabs({ defaultTab, business, question }: ContactTabsProps): JSX.Element {
    const t = useTranslations('ContactPage');

    return (
        <Tabs.Root defaultValue={defaultTab}>
            <Tabs.List
                aria-label={t('tabsLabel')}
                className="mx-auto grid max-w-md grid-cols-2 gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800"
            >
                <Tabs.Trigger value="business" className={TRIGGER_CLASS}>
                    <Building2 aria-hidden="true" className="size-4 shrink-0" />
                    {t('tabBusiness')}
                </Tabs.Trigger>
                <Tabs.Trigger value="question" className={TRIGGER_CLASS}>
                    <MessageSquare aria-hidden="true" className="size-4 shrink-0" />
                    {t('tabQuestion')}
                </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="business" className={CONTENT_CLASS}>
                {business}
            </Tabs.Content>
            <Tabs.Content value="question" className={CONTENT_CLASS}>
                {question}
            </Tabs.Content>
        </Tabs.Root>
    );
}
