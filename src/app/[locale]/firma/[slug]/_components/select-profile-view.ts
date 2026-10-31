import { isPremiumActive, type PremiumSubscriptionState } from '@/lib/premium';
import type { PremiumTemplate } from '@/lib/premium-templates';

import type { PremiumContent, PremiumProfileView, ServiceProfileView } from './service-profile-types';

/** Szablon premium, gdy wpis ma aktywne premium, a tresc nie jest jeszcze opublikowana. */
export const DEFAULT_PREMIUM_TEMPLATE: PremiumTemplate = 'classic';

export type ProfileViewKind = { kind: 'free' } | { kind: 'premium'; template: PremiumTemplate };

export type SelectProfileViewInput = {
    /** Tresc premium z `service_profiles`; zostaje w bazie takze po wygasnieciu premium. */
    premiumContent: Pick<PremiumContent, 'template'> | null;
    subscription: PremiumSubscriptionState | null;
    now: Date;
};

/**
 * Jedyna decyzja, ktory widok profilu renderujemy. Strona i `generateMetadata` wolaja
 * ja z tymi samymi danymi, wiec cover w Open Graph pojawia sie tylko przy szablonie premium.
 */
export function selectProfileView({
    premiumContent,
    subscription,
    now,
}: SelectProfileViewInput): ProfileViewKind {
    if (!isPremiumActive(subscription, now)) return { kind: 'free' };

    return { kind: 'premium', template: premiumContent?.template ?? DEFAULT_PREMIUM_TEMPLATE };
}

const EMPTY_PREMIUM_CONTENT: PremiumContent = {
    template: DEFAULT_PREMIUM_TEMPLATE,
    coverImage: null,
    gallery: [],
    priceList: [],
    faq: [],
};

/** Wejscie szablonu premium; bez opublikowanej tresci szablon dostaje dane free i pusta tresc. */
export function toPremiumProfileView(view: ServiceProfileView): PremiumProfileView {
    return { ...view, premium: view.premium ?? EMPTY_PREMIUM_CONTENT };
}
