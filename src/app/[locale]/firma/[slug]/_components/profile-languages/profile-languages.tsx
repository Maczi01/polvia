import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { LANGUAGE_FLAG_PATHS, type ServiceLanguage } from '@/lib/languages';
import { cn } from '@/lib/utilities';

type ProfileLanguagesProps = {
    languages: readonly ServiceLanguage[];
    className?: string;
};

export function ProfileLanguages({
    languages,
    className,
}: ProfileLanguagesProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');
    const tLanguages = useTranslations('addBusiness.languages');

    if (languages.length === 0) return null;

    return (
        <div className={className}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('languages')}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
                {languages.map(language => (
                    <li
                        key={language}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1.5 pr-3 text-sm text-gray-700',
                            'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
                        )}
                    >
                        {/* Flaga jest ozdobnikiem: nazwa jezyka stoi obok jako tekst. */}
                        <Image
                            src={LANGUAGE_FLAG_PATHS[language]}
                            alt=""
                            width={22}
                            height={16}
                            className="rounded-sm"
                        />
                        {tLanguages(language)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
