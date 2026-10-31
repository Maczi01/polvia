import { Globe, MapPin, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { VOIVODESHIP_TO_MESSAGE_KEY } from '@/lib/consts';
import { cn } from '@/lib/utilities';

import { getAddressedLocations } from '../profile-helpers';
import { ProfileSection } from '../profile-section/profile-section';
import type { ProfileLocation, ServiceProfileView } from '../service-profile-types';

type ProfileLocationsProps = {
    profile: Pick<ServiceProfileView, 'coverage' | 'locations' | 'mapHref'>;
    className?: string;
    titleClassName?: string;
};

function LocationAddress({
    location,
    showMainLabel,
    showPhone,
}: {
    location: ProfileLocation;
    showMainLabel: boolean;
    showPhone: boolean;
}): ReactElement {
    const t = useTranslations('ServiceProfile');
    const tCounties = useTranslations('MapPage.counties');
    const voivodeshipKey = location.voivodeship
        ? VOIVODESHIP_TO_MESSAGE_KEY[location.voivodeship]
        : undefined;
    const cityLine = [location.postcode, location.city].filter(Boolean).join(' ');

    return (
        <li className="flex gap-3">
            <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0 text-sm leading-6 text-gray-700 dark:text-gray-300">
                {showMainLabel && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                        {t('mainLocation')}
                    </p>
                )}
                <address className="not-italic">
                    {location.street && <span className="block">{location.street}</span>}
                    {cityLine && <span className="block">{cityLine}</span>}
                    {voivodeshipKey && (
                        <span className="block text-gray-500 dark:text-gray-400">
                            {tCounties(voivodeshipKey)}
                        </span>
                    )}
                </address>
                {showPhone && location.phoneNumber && (
                    <a
                        href={`tel:${location.phoneNumber}`}
                        className="mt-1 inline-flex items-center gap-1.5 rounded text-gray-700 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-gray-300"
                    >
                        <Phone size={14} aria-hidden="true" />
                        {location.phoneNumber}
                    </a>
                )}
            </div>
        </li>
    );
}

/**
 * Adres(y) z linkiem do mapy. Wpis `online` nie ma punktu obslugi: zamiast adresu
 * dostaje informacje o obsludze zdalnej, a mapy nie ma wcale.
 */
export function ProfileLocations({
    profile,
    className,
    titleClassName,
}: ProfileLocationsProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');

    if (profile.coverage === 'online') {
        return (
            <p
                className={cn(
                    'flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100',
                    className,
                )}
            >
                <Globe size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                {t('onlineOnly')}
            </p>
        );
    }

    const locations = getAddressedLocations(profile);
    if (locations.length === 0) return null;
    const hasMany = locations.length > 1;

    return (
        <ProfileSection
            id="locations"
            title={hasMany ? t('locations') : t('address')}
            className={className}
            titleClassName={titleClassName}
        >
            <ul className="flex flex-col gap-5">
                {locations.map(location => (
                    <LocationAddress
                        key={location.id}
                        location={location}
                        showMainLabel={hasMany && location.isMainLocation}
                        showPhone={hasMany && !location.isMainLocation}
                    />
                ))}
            </ul>
            {profile.mapHref && (
                <Link
                    href={profile.mapHref}
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-gray-600 dark:text-gray-100"
                >
                    <MapPin size={16} aria-hidden="true" />
                    {t('showOnMap')}
                </Link>
            )}
        </ProfileSection>
    );
}
