import { useTranslations } from 'next-intl';

import { getLocationSummary, HEADER_MAX_CITIES } from './profile-location-groups';
import type { ServiceProfileView } from './service-profile-types';

/**
 * Tekst pod nazwa firmy. Jedna lokalizacja: samo miasto. Kilka: do trzech miast,
 * „i N inne” i liczba lokalizacji (`Poznań, Bydgoszcz, Szczecin i 2 inne · 8 lokalizacji`).
 * Wpis bez punktu obslugi: `null`.
 */
export function useHeaderPlace(
    profile: Pick<ServiceProfileView, 'coverage' | 'locations'>,
): string | null {
    const t = useTranslations('ServiceProfile');
    const { cities, locationCount } = getLocationSummary(profile);

    if (locationCount <= 1) return cities[0] ?? null;

    const shown = cities.slice(0, HEADER_MAX_CITIES).join(', ');
    const moreCount = cities.length - HEADER_MAX_CITIES;
    const place =
        moreCount > 0 ? t('headerMoreCities', { cities: shown, count: moreCount }) : shown;
    const countText = t('locationCount', { count: locationCount });
    return place ? `${place} · ${countText}` : countText;
}
