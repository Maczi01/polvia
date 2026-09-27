import type { VariantProps } from 'class-variance-authority';

import type { buttonVariants } from '@/app/[locale]/(main)/_components/button-category/button-category';
import type { badgeVariants } from '@/components/ui/badge/badge';

/**
 * Jedyne zrodlo kategorii (branz) w aplikacji.
 *
 * `CATEGORY_VALUES` to wartosci enuma `category` w Postgresie — `schema.ts` buduje
 * z nich `pgEnum`. Kolejnosc jest kolejnoscia w bazie, NIE zmieniaj jej: `drizzle-kit
 * push` porownuje liste wartosci. Nowa kategoria = nowa wartosc tutaj, a kompilator
 * wskaze kazde miejsce, ktore wymaga wpisu (`CATEGORY_DEFINITIONS`, slugi).
 *
 * Moduł nie ma importow runtime'owych, bo czyta go i `schema.ts` (drizzle-kit,
 * skrypty `tsx`), i komponenty klienckie (header).
 */
export const CATEGORY_VALUES = [
    'others',
    'education',
    'renovation',
    'financial',
    'grocery',
    'beauty',
    'gastronomy',
    'transport',
    'law',
    'mechanics',
    'health',
    'real_estate',
    'help_support',
    'it',
] as const;

export type Category = (typeof CATEGORY_VALUES)[number];

type ButtonCategoryVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export type CategoryDefinition = {
    /** Klucz w `MapPage.Categories` w plikach `messages/`. */
    text: string;
    /** Ikona w filtrach i sekcji kategorii. */
    image: string;
    /** Pin na mapie. */
    marker: string;
    /** Kolor przycisku kategorii (filtry, sekcja kategorii). */
    variant: ButtonCategoryVariant;
    /** Kolor badge'a kategorii na kartach uslug. */
    badgeColor: BadgeVariant;
};

/** Kolejnosc wpisow = kolejnosc wyswietlania w UI. */
export const CATEGORY_DEFINITIONS: Record<Category, CategoryDefinition> = {
    grocery: {
        text: 'Grocery',
        image: '/icons/grocery.svg',
        marker: '/markers/grocery.svg',
        variant: 'red',
        badgeColor: 'red',
    },
    gastronomy: {
        text: 'Gastronomy',
        image: '/icons/gastronomy.svg',
        marker: '/markers/gastronomy.svg',
        variant: 'oversky',
        badgeColor: 'oversky',
    },
    transport: {
        text: 'Transport',
        image: '/icons/transport.svg',
        marker: '/markers/transport.svg',
        variant: 'green',
        badgeColor: 'green',
    },
    financial: {
        text: 'Financial',
        image: '/icons/financial.svg',
        marker: '/markers/financial.svg',
        variant: 'orange',
        badgeColor: 'orange',
    },
    renovation: {
        text: 'Renovation',
        image: '/icons/renovation.svg',
        marker: '/markers/renovation.svg',
        variant: 'blue',
        badgeColor: 'lightblue',
    },
    law: {
        text: 'Law',
        image: '/icons/law.svg',
        marker: '/markers/law.svg',
        variant: 'gold',
        badgeColor: 'gold',
    },
    beauty: {
        text: 'Beauty',
        image: '/icons/beauty.svg',
        marker: '/markers/beauty.svg',
        variant: 'violet',
        badgeColor: 'pinkred',
    },
    health: {
        text: 'Health',
        image: '/icons/health.svg',
        marker: '/markers/health.svg',
        variant: 'lightblue',
        badgeColor: 'aqua',
    },
    mechanics: {
        text: 'Mechanics',
        image: '/icons/mechanic.svg',
        marker: '/markers/mechanics.svg',
        variant: 'darkviolet',
        badgeColor: 'darkviolet',
    },
    real_estate: {
        text: 'RealEstate',
        image: '/icons/real-estate.svg',
        marker: '/markers/real-estate.svg',
        variant: 'starfall',
        badgeColor: 'violet',
    },
    help_support: {
        text: 'HelpSupport',
        image: '/icons/help-support.svg',
        marker: '/markers/help-support.svg',
        variant: 'coral',
        badgeColor: 'coral',
    },
    education: {
        text: 'Education',
        image: '/icons/education.svg',
        marker: '/markers/education.svg',
        variant: 'overworld',
        badgeColor: 'sapphire',
    },
    it: {
        text: 'IT',
        image: '/icons/it.svg',
        marker: '/markers/it.svg',
        variant: 'tech',
        badgeColor: 'tech',
    },
    others: {
        text: 'Others',
        image: '/icons/others.svg',
        marker: '/markers/others.svg',
        variant: 'mojito',
        badgeColor: 'others',
    },
};

const DISPLAY_ORDER: string[] = Object.keys(CATEGORY_DEFINITIONS);

/** Kategorie w kolejnosci wyswietlania, z kluczem — do list w UI. */
export const CATEGORIES: readonly (CategoryDefinition & { key: Category })[] = [...CATEGORY_VALUES]
    .sort((a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b))
    .map(key => ({ key, ...CATEGORY_DEFINITIONS[key] }));

/**
 * `Set` z wartosci enuma, a nie `value in CATEGORY_DEFINITIONS`: `in` widzi takze
 * prototyp, wiec `isCategory('toString')` zwracaloby `true` i wpuszczalo smiec
 * do zapytania i do filtra SQL.
 */
const CATEGORY_SET: ReadonlySet<string> = new Set<string>(CATEGORY_VALUES);

export function isCategory(value: string | null | undefined): value is Category {
    return value !== null && value !== undefined && CATEGORY_SET.has(value);
}

/** Klucz tlumaczenia kategorii; nieznana wartosc dostaje "Others". */
export function getCategoryMessageKey(category: string): string {
    return isCategory(category) ? CATEGORY_DEFINITIONS[category].text : CATEGORY_DEFINITIONS.others.text;
}
