import { ChevronDown, Globe, MapPin, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { VOIVODESHIP_TO_MESSAGE_KEY } from '@/lib/consts';
import { cn } from '@/lib/utilities';

import { getAddressedLocations } from '../profile-helpers';
import {
    type CityGroup,
    groupLocationsByCity,
    splitVisibleGroups,
} from '../profile-location-groups';
import { ProfileSection } from '../profile-section/profile-section';
import type { ProfileLocation, ServiceProfileView } from '../service-profile-types';

type ProfileLocationsProps = {
    profile: Pick<ServiceProfileView, 'coverage' | 'locations' | 'mapHref'>;
    className?: string;
    titleClassName?: string;
};

/** Jedyny adres firmy: pelny, z wojewodztwem, bez etykiety siedziby i telefonu. */
function SingleLocationAddress({ location }: { location: ProfileLocation }): ReactElement {
    const tCounties = useTranslations('MapPage.counties');
    const voivodeshipKey = location.voivodeship
        ? VOIVODESHIP_TO_MESSAGE_KEY[location.voivodeship]
        : undefined;
    const cityLine = [location.postcode, location.city].filter(Boolean).join(' ');

    return (
        <li className="flex gap-3">
            <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0 text-sm leading-6 text-gray-700 dark:text-gray-300">
                <address className="not-italic">
                    {location.street && <span className="block">{location.street}</span>}
                    {cityLine && <span className="block">{cityLine}</span>}
                    {voivodeshipKey && (
                        <span className="block text-gray-500 dark:text-gray-400">
                            {tCounties(voivodeshipKey)}
                        </span>
                    )}
                </address>
            </div>
        </li>
    );
}

function LocationPhone({ phoneNumber }: { phoneNumber: string }): ReactElement {
    return (
        <a
            href={`tel:${phoneNumber}`}
            className="mt-1 inline-flex items-center gap-1.5 rounded text-gray-700 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-gray-300"
        >
            <Phone size={14} aria-hidden="true" />
            {phoneNumber}
        </a>
    );
}

/** Adres w jednej linii (`ulica, kod`): miasto jest w naglowku grupy, bez wojewodztwa. */
function CompactLocationAddress({ location }: { location: ProfileLocation }): ReactElement {
    const t = useTranslations('ServiceProfile');
    const line = [location.street, location.postcode].filter(Boolean).join(', ') || location.city;

    return (
        <li className="flex gap-3">
            <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0 text-sm leading-6 text-gray-700 dark:text-gray-300">
                {location.isMainLocation && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                        {t('mainLocation')}
                    </p>
                )}
                <address className="not-italic">{line}</address>
                {!location.isMainLocation && location.phoneNumber && (
                    <LocationPhone phoneNumber={location.phoneNumber} />
                )}
            </div>
        </li>
    );
}

function CityGroups({ groups }: { groups: readonly CityGroup[] }): ReactElement {
    const t = useTranslations('ServiceProfile');

    return (
        <div className="flex flex-col gap-5">
            {groups.map(group => (
                <div key={group.city ?? ''}>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {group.city ?? t('noCityGroup')}
                        {group.locations.length > 1 && (
                            <span className="font-normal text-gray-500 dark:text-gray-400">
                                {` (${group.locations.length})`}
                            </span>
                        )}
                    </h3>
                    <ul className="mt-2 flex flex-col gap-3">
                        {group.locations.map(location => (
                            <CompactLocationAddress key={location.id} location={location} />
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

/**
 * Kilka adresow: grupy miast, a powyzej limitu reszta w natywnym `<details>` — dziala bez JS
 * (Server Component), z klawiatury, a zwiniete adresy zostaja w HTML dla wyszukiwarek.
 */
function GroupedLocations({ locations }: { locations: readonly ProfileLocation[] }): ReactElement {
    const t = useTranslations('ServiceProfile');
    const { visible, hidden } = splitVisibleGroups(groupLocationsByCity(locations));
    const hiddenCount = hidden.reduce((sum, group) => sum + group.locations.length, 0);
    const hiddenCities = hidden.flatMap(group => (group.city ? [group.city] : [])).join(', ');
    const summary = t('showMoreLocations', { count: hiddenCount });

    return (
        <>
            <CityGroups groups={visible} />
            {hidden.length > 0 && (
                <details className="group mt-5">
                    <summary className="flex cursor-pointer list-none items-start gap-2 rounded-md text-sm font-semibold text-gray-900 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
                        <ChevronDown
                            size={18}
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-brand transition-transform group-open:rotate-180"
                        />
                        {hiddenCities ? `${summary} (${hiddenCities})` : summary}
                    </summary>
                    <div className="mt-5">
                        <CityGroups groups={hidden} />
                    </div>
                </details>
            )}
        </>
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
            {hasMany ? (
                <GroupedLocations locations={locations} />
            ) : (
                <ul className="flex flex-col gap-5">
                    {locations.map(location => (
                        <SingleLocationAddress key={location.id} location={location} />
                    ))}
                </ul>
            )}
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
