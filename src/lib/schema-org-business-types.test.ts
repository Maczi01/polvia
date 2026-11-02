import { CATEGORY_VALUES } from '@/lib/categories';

import { CATEGORY_SCHEMA_TYPES, getLocalBusinessSchemaType } from './schema-org-business-types';

/** `LocalBusiness` i podtypy z hierarchii schema.org, ktore dopuszcza mapowanie. */
const LOCAL_BUSINESS_TYPES: ReadonlySet<string> = new Set([
    'LocalBusiness',
    'GroceryStore',
    'FoodEstablishment',
    'FinancialService',
    'HomeAndConstructionBusiness',
    'LegalService',
    'HealthAndBeautyBusiness',
    'MedicalBusiness',
    'AutomotiveBusiness',
    'RealEstateAgent',
]);

describe('CATEGORY_SCHEMA_TYPES', () => {
    it.each(CATEGORY_VALUES)('kategoria %s ma typ z hierarchii LocalBusiness', category => {
        expect(LOCAL_BUSINESS_TYPES.has(CATEGORY_SCHEMA_TYPES[category])).toBe(true);
    });

    it('ma dokladnie klucze CATEGORY_VALUES', () => {
        expect(Object.keys(CATEGORY_SCHEMA_TYPES).sort()).toEqual([...CATEGORY_VALUES].sort());
    });
});

describe('getLocalBusinessSchemaType', () => {
    it('znana kategoria daje typ z mapowania', () => {
        expect(getLocalBusinessSchemaType('beauty')).toBe('HealthAndBeautyBusiness');
    });

    it('nieznana wartosc z bazy daje LocalBusiness', () => {
        expect(getLocalBusinessSchemaType('toString')).toBe('LocalBusiness');
    });
});
