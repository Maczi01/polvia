import { MapPin } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { buildStaticMapUrl, type StaticMapPoint } from '@/lib/static-map-url';

import { getAddressedLocations } from '../profile-helpers';
import { ProfileSection } from '../profile-section/profile-section';
import type { ServiceProfileView } from '../service-profile-types';

/** Szeroki baner (Mapbox: najwyzej 1280 na bok); obraz w `@2x`, skalowany z zachowaniem proporcji. */
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 400;
/** Jeden punkt: kadr ulicy. Kilka punktow: kadr `auto` z marginesem dla pinow przy krawedzi. */
const SINGLE_PIN_ZOOM = 15;
const AUTO_PADDING = 60;

const ATTRIBUTION_LINK_CLASSES =
    'rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600';

type ProfileMapProps = {
    profile: Pick<ServiceProfileView, 'name' | 'coverage' | 'locations' | 'mapHref'>;
    className?: string;
    titleClassName?: string;
};

type MapLocation = StaticMapPoint & { city: string | null };

/** Punkty z adresem i wspolrzednymi, glowny pierwszy; wpis `online` nie ma zadnego. */
function getMapLocations(profile: ProfileMapProps['profile']): MapLocation[] {
    return getAddressedLocations(profile).flatMap(location =>
        location.latitude === null || location.longitude === null
            ? []
            : [{ lat: location.latitude, lng: location.longitude, city: location.city }],
    );
}

function joinCities(locations: readonly MapLocation[]): string {
    const cities = locations.flatMap(location => (location.city ? [location.city] : []));
    return [...new Set(cities)].join(', ');
}

/** Atrybucja wymagana przez Mapbox i OpenStreetMap (jak w podgladzie pinu przy dodawaniu firmy). */
function MapAttribution(): ReactElement {
    return (
        <figcaption className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <a
                href="https://www.mapbox.com/about/maps/"
                target="_blank"
                rel="noopener noreferrer"
                className={ATTRIBUTION_LINK_CLASSES}
            >
                © Mapbox
            </a>{' '}
            <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className={ATTRIBUTION_LINK_CLASSES}
            >
                © OpenStreetMap
            </a>
        </figcaption>
    );
}

/**
 * Statyczna mapa punktow obslugi na dole strony premium — obraz Mapbox, bez mapbox-gl.
 * Bez punktu ze wspolrzednymi (wpis `online`, brak geokodowania) sekcji nie ma.
 * Obraz linkuje do mapy katalogu tylko, gdy wpis ma `mapHref`.
 *
 * `unoptimized`: obraz idzie z Mapboxa prosto do przegladarki (`next.config.ts` nie ma
 * `images.remotePatterns`).
 */
export function ProfileMap({
    profile,
    className,
    titleClassName,
}: ProfileMapProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');
    const [first, ...rest] = getMapLocations(profile);
    if (!first) return null;

    const cities = joinCities([first, ...rest]);
    const alt = cities
        ? t('mapAlt', { name: profile.name, cities })
        : t('mapAltNoCity', { name: profile.name });
    const image = (
        <Image
            src={buildStaticMapUrl({
                pins: [first, ...rest],
                width: MAP_WIDTH,
                height: MAP_HEIGHT,
                zoom: SINGLE_PIN_ZOOM,
                padding: AUTO_PADDING,
            })}
            alt={alt}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            unoptimized
            className="h-auto w-full rounded-xl border border-gray-200 dark:border-gray-700"
        />
    );

    return (
        <ProfileSection
            id="profile-map"
            title={t('mapTitle')}
            className={className}
            titleClassName={titleClassName}
        >
            <figure>
                {profile.mapHref ? (
                    <Link
                        href={profile.mapHref}
                        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                        {image}
                    </Link>
                ) : (
                    image
                )}
                <MapAttribution />
            </figure>
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
