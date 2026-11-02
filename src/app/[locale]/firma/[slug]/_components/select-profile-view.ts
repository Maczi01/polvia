import { hasActivePremium, type PremiumState } from '@/lib/premium';
import type { PremiumTemplate } from '@/lib/premium-templates';

import type {
    PremiumContent,
    PremiumProfileView,
    ServiceProfileView,
} from './service-profile-types';

/** Szablon premium, gdy wpis ma aktywne premium, a tresc nie jest jeszcze opublikowana. */
const DEFAULT_PREMIUM_TEMPLATE: PremiumTemplate = 'classic';

/**
 * Wynik decyzji widoku. Tresc premium niesie tylko wariant `premium` — widok free nie ma
 * do niej dostepu, wiec nie moze jej przypadkiem wyrenderowac ani wypuscic do OG (R18).
 */
export type ProfileViewKind =
    | { kind: 'free' }
    | { kind: 'premium'; template: PremiumTemplate; content: PremiumContent | null };

export type SelectProfileViewInput = PremiumState & {
    /**
     * Tresc premium z `service_profiles` (walidacja Zod + lokalizacja). Wolana dopiero przy
     * aktywnym premium: profil free nie parsuje jsonb, a uszkodzony wiersz nie loguje bledu
     * przy kazdym wejsciu na profil darmowy. Tresc zostaje w bazie po wygasnieciu premium.
     */
    loadPremiumContent: () => PremiumContent | null;
    now: Date;
};

/**
 * Jedyna decyzja, ktory widok profilu renderujemy (premium = subskrypcja albo premium reczne). Strona i `generateMetadata` wolaja
 * ja z tymi samymi danymi, wiec cover w Open Graph pojawia sie tylko przy szablonie premium.
 */
export function selectProfileView({
    loadPremiumContent,
    subscription,
    manualPremiumUntil,
    now,
}: SelectProfileViewInput): ProfileViewKind {
    if (!hasActivePremium({ subscription, manualPremiumUntil }, now)) return { kind: 'free' };

    const content = loadPremiumContent();
    return { kind: 'premium', template: content?.template ?? DEFAULT_PREMIUM_TEMPLATE, content };
}

/** Cover w Open Graph tylko przy widoku premium: tresc wygaslego premium zostaje w bazie (R18). */
export function selectOgCoverPath(viewKind: ProfileViewKind): string | null {
    if (viewKind.kind !== 'premium') return null;

    return viewKind.content?.coverImage?.src ?? null;
}

/** Szablony premium nie pokazuja „Podobnych firm”, wiec przy premium ich nie pobieramy. */
export function shouldLoadSimilarServices(viewKind: ProfileViewKind): boolean {
    return viewKind.kind === 'free';
}

const EMPTY_PREMIUM_CONTENT: PremiumContent = {
    template: DEFAULT_PREMIUM_TEMPLATE,
    coverImage: null,
    gallery: [],
    priceList: [],
    faq: [],
    ratings: [],
};

/** Wejscie szablonu premium; bez opublikowanej tresci szablon dostaje dane free i pusta tresc. */
export function toPremiumProfileView(view: ServiceProfileView): PremiumProfileView {
    return { ...view, premium: view.premium ?? EMPTY_PREMIUM_CONTENT };
}
