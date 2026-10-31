import { hasLocale } from 'next-intl';

import {
    type LocalizedPremiumContent,
    localizePremiumContent,
    premiumContentSchema,
} from '@/db/premium-content-schema';
import { defaultLocale, locales } from '@/i18n/config';

type PremiumContentSource = { serviceId: string; slug: string; locale: string; name: string };

/**
 * Jsonb z `service_profiles` -> tresc dla locale. Walidowany przy odczycie, bo baza nie
 * pilnuje ksztaltu: uszkodzona tresc daje profil bez premium, a nie wywalona strone.
 */
export function toPremiumContent(
    stored: unknown,
    { serviceId, slug, locale, name }: PremiumContentSource,
): LocalizedPremiumContent | null {
    if (stored === null || stored === undefined) return null;

    const parsed = premiumContentSchema.safeParse(stored);
    if (!parsed.success) {
        // Same sciezki pol, bez wartosci. Brak loggera w repo: log Vercela to jedyny slad.
        // eslint-disable-next-line no-console
        console.error('service profile premium content invalid', {
            serviceId,
            issues: parsed.error.issues.map(issue => issue.path.join('.')),
        });
        return null;
    }

    return localizePremiumContent(parsed.data, {
        serviceSlug: slug,
        locale: hasLocale(locales, locale) ? locale : defaultLocale,
        coverAlt: name,
    });
}
