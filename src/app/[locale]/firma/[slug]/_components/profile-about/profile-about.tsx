import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import type { ServiceLanguage } from '@/lib/languages';
import { cn } from '@/lib/utilities';

import { ProfileLanguages } from '../profile-languages/profile-languages';
import { ProfileSection } from '../profile-section/profile-section';

type ProfileAboutProps = {
    description: string | null;
    languages: readonly ServiceLanguage[];
    tags: readonly string[];
    className?: string;
    titleClassName?: string;
    /** Np. zdjecie w szablonie Profesjonalnym, nad opisem. */
    media?: ReactElement | null;
};

export function ProfileAbout({
    description,
    languages,
    tags,
    className,
    titleClassName,
    media,
}: ProfileAboutProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');

    if (!description && languages.length === 0 && tags.length === 0) return null;

    return (
        <ProfileSection
            id="about"
            title={t('about')}
            className={className}
            titleClassName={titleClassName}
        >
            {media}
            {description && (
                <p
                    className={cn(
                        'whitespace-pre-line text-base leading-7 text-gray-700 dark:text-gray-300',
                        media && 'mt-5',
                    )}
                >
                    {description}
                </p>
            )}
            <ProfileLanguages languages={languages} className={cn(description && 'mt-6')} />
            {tags.length > 0 && (
                <div className={cn((description || languages.length > 0) && 'mt-6')}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {t('tags')}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <li
                                key={tag}
                                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                            >
                                {tag}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </ProfileSection>
    );
}
