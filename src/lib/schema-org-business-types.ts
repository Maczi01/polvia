import { type Category, isCategory } from '@/lib/categories';

/**
 * Typ schema.org (JSON-LD) wpisu z punktem obslugi, wyprowadzony z kategorii.
 *
 * Kazdy typ to `LocalBusiness` albo jego podtyp (sprawdzone na schema.org), bo wpis
 * `local`/`hybrid` ma adres, wspolrzedne i godziny — wlasnosci `LocalBusiness`.
 * Kategoria zbyt szeroka na konkretny podtyp dostaje `LocalBusiness`:
 * - `transport` (kurierzy, przewozy osob, przeprowadzki) — `MovingCompany` byloby nieprawda
 *   dla wiekszosci wpisow, a `TaxiService` to `Service`, nie firma z adresem;
 * - `education` — `EducationalOrganization` nie jest podtypem `LocalBusiness`;
 * - `it` — `ProfessionalService` schema.org opisuje jako wycofany (mylony z `Service`);
 * - `others`, `help_support` — kubly na uslugi spoza branz.
 *
 * `satisfies Record<Category, …>`: nowa kategoria nie skompiluje sie bez decyzji o typie.
 */
export const CATEGORY_SCHEMA_TYPES = {
    grocery: 'GroceryStore',
    gastronomy: 'FoodEstablishment',
    transport: 'LocalBusiness',
    financial: 'FinancialService',
    renovation: 'HomeAndConstructionBusiness',
    law: 'LegalService',
    beauty: 'HealthAndBeautyBusiness',
    health: 'MedicalBusiness',
    mechanics: 'AutomotiveBusiness',
    real_estate: 'RealEstateAgent',
    help_support: 'LocalBusiness',
    education: 'LocalBusiness',
    it: 'LocalBusiness',
    others: 'LocalBusiness',
} as const satisfies Record<Category, string>;

export type LocalBusinessSchemaType = (typeof CATEGORY_SCHEMA_TYPES)[Category];

/** Typ schema.org dla klucza kategorii z bazy; nieznana wartosc dostaje `LocalBusiness`. */
export function getLocalBusinessSchemaType(category: string): LocalBusinessSchemaType {
    return isCategory(category) ? CATEGORY_SCHEMA_TYPES[category] : 'LocalBusiness';
}
