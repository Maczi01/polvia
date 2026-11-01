import { Globe, Mail, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utilities';

import { ProfileActions } from '../profile-actions/profile-actions';
import {
    getActionHrefs,
    getSocialLinks,
    hasAnyAction,
    toDisplayDomain,
    toWebsiteHref,
} from '../profile-helpers';
import { ProfileSection } from '../profile-section/profile-section';
import type { ProfileLocation } from '../service-profile-types';
import { SOCIAL_BACKGROUNDS, SOCIAL_LABELS, SocialIcon } from './social-icons';

const ROW_LINK =
    'flex min-w-0 items-center gap-3 rounded-md text-sm text-gray-700 transition-colors hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-gray-300 dark:hover:text-white';

function ContactRow({ icon, children }: { icon: ReactNode; children: ReactNode }): ReactElement {
    return (
        <li className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                {icon}
            </span>
            {children}
        </li>
    );
}

type ProfileContactProps = {
    location: ProfileLocation | null;
    /** Przyciski akcji pod danymi; wylacz, gdy szablon ma je w naglowku. */
    showActions: boolean;
    showNavigate: boolean;
    className?: string;
    titleClassName?: string;
};

export function ProfileContact({
    location,
    showActions,
    showNavigate,
    className,
    titleClassName,
}: ProfileContactProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');

    if (!location) return null;

    const socialLinks = getSocialLinks(location.socials);
    const hasActions = showActions && hasAnyAction(getActionHrefs(location, showNavigate));
    const hasDetails = Boolean(location.phoneNumber || location.email || location.webpage);

    if (!hasDetails && socialLinks.length === 0 && !hasActions) return null;

    return (
        <ProfileSection
            id="contact"
            title={t('contact')}
            className={className}
            titleClassName={titleClassName}
        >
            {hasDetails && (
                <ul className="flex flex-col gap-3">
                    {location.phoneNumber && (
                        <ContactRow icon={<Phone size={16} aria-hidden="true" />}>
                            <a href={`tel:${location.phoneNumber}`} className={ROW_LINK}>
                                <span className="sr-only">{t('phone')}: </span>
                                {location.phoneNumber}
                            </a>
                        </ContactRow>
                    )}
                    {location.email && (
                        <ContactRow icon={<Mail size={16} aria-hidden="true" />}>
                            <a href={`mailto:${location.email}`} className={ROW_LINK}>
                                <span className="sr-only">{t('email')}: </span>
                                <span className="break-all">{location.email}</span>
                            </a>
                        </ContactRow>
                    )}
                    {location.webpage && (
                        <ContactRow icon={<Globe size={16} aria-hidden="true" />}>
                            <a
                                href={toWebsiteHref(location.webpage)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(ROW_LINK, 'text-blue-700 dark:text-blue-400')}
                            >
                                <span className="sr-only">{t('website')}: </span>
                                {toDisplayDomain(location.webpage)}
                            </a>
                        </ContactRow>
                    )}
                </ul>
            )}

            {socialLinks.length > 0 && (
                <ul aria-label={t('socials')} className={cn('flex flex-wrap gap-2', hasDetails && 'mt-5')}>
                    {socialLinks.map(({ key, href }) => (
                        <li key={key}>
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={SOCIAL_LABELS[key]}
                                className={cn(
                                    'flex size-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-85',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2',
                                    SOCIAL_BACKGROUNDS[key],
                                )}
                            >
                                <SocialIcon network={key} />
                            </a>
                        </li>
                    ))}
                </ul>
            )}

            {hasActions && (
                <ProfileActions
                    location={location}
                    showNavigate={showNavigate}
                    className={cn((hasDetails || socialLinks.length > 0) && 'mt-5')}
                />
            )}
        </ProfileSection>
    );
}
