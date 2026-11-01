import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { ProfileSection } from '../profile-section/profile-section';
import type { FaqItem } from '../service-profile-types';

type ProfileFaqProps = {
    items: readonly FaqItem[];
    className?: string;
    titleClassName?: string;
};

/**
 * Natywne `<details>`: dziala bez JS (Server Component), z klawiatury (Enter/Spacja
 * na `summary`), a tresc odpowiedzi zostaje w HTML dla wyszukiwarek.
 */
export function ProfileFaq({ items, className, titleClassName }: ProfileFaqProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');

    if (items.length === 0) return null;

    return (
        <ProfileSection id="faq" title={t('faq')} className={className} titleClassName={titleClassName}>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(item => (
                    <details key={item.question} className="group py-1 first:pt-0 last:pb-0">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-3 font-medium text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
                            {item.question}
                            <ChevronDown
                                size={20}
                                aria-hidden="true"
                                className="shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                            />
                        </summary>
                        <p className="pb-4 pr-8 text-sm leading-6 text-gray-600 dark:text-gray-300">
                            {item.answer}
                        </p>
                    </details>
                ))}
            </div>
        </ProfileSection>
    );
}
