import { categoryEnum } from '@/db/schema';
import {
    CATEGORIES,
    CATEGORY_DEFINITIONS,
    CATEGORY_VALUES,
    getCategoryMessageKey,
    isCategory,
} from '@/lib/categories';
import plMessages from '../../messages/pl.json';

describe('CATEGORIES', () => {
    it('zawiera kazda kategorie z bazy dokladnie raz', () => {
        const keys = CATEGORIES.map(({ key }) => key);

        expect([...keys].sort()).toEqual([...categoryEnum.enumValues].sort());
    });

    it('nie zawiera kategorii spoza enuma (np. dawnego "government")', () => {
        const keys: string[] = CATEGORIES.map(({ key }) => key);

        expect(keys).not.toContain('government');
    });

    it('trzyma kolejnosc wyswietlania z CATEGORY_DEFINITIONS, nie kolejnosc enuma', () => {
        expect(CATEGORIES[0]?.key).toBe('grocery');
        expect(CATEGORIES.at(-1)?.key).toBe('others');
    });

    it('niesie dane definicji razem z kluczem', () => {
        const it = CATEGORIES.find(({ key }) => key === 'it');

        expect(it).toEqual({ key: 'it', ...CATEGORY_DEFINITIONS.it });
    });
});

describe('CATEGORY_VALUES', () => {
    // Kopia enuma `category` z zywej bazy. Zmiana kolejnosci albo wartosci tutaj
    // to zmiana schematu dla `drizzle-kit push` — musi byc swiadoma, nie efektem refaktoru.
    const POSTGRES_CATEGORY_ENUM = [
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
    ];

    it('odpowiada enumowi w bazie wartosciami i kolejnoscia', () => {
        expect(CATEGORY_VALUES).toEqual(POSTGRES_CATEGORY_ENUM);
        expect(categoryEnum.enumValues).toEqual(POSTGRES_CATEGORY_ENUM);
    });
});

describe('isCategory', () => {
    it('akceptuje wartosc z enuma', () => {
        expect(isCategory('real_estate')).toBe(true);
    });

    it('odrzuca nieznana wartosc, null i klucze prototypu', () => {
        expect(isCategory('government')).toBe(false);
        expect(isCategory(null)).toBe(false);
        expect(isCategory('toString')).toBe(false);
    });
});

describe('getCategoryMessageKey', () => {
    it('zwraca klucz tlumaczenia, ktory istnieje w messages', () => {
        const key = getCategoryMessageKey('help_support');

        expect(key).toBe('HelpSupport');
        const labels: Record<string, string> = plMessages.MapPage.Categories;
        expect(labels[key]).toBe('Pomoc i wsparcie');
    });

    it('dla nieznanej kategorii zwraca "Others"', () => {
        expect(getCategoryMessageKey('government')).toBe('Others');
    });
});
