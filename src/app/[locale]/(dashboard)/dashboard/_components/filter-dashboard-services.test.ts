import { filterDashboardServices } from './filter-dashboard-services';

const KSIEGOWA = {
    name: 'Dobra Księgowa',
    slug: 'dobra-ksiegowa',
    category: 'financial',
    city: 'Łódź',
    nip: '1234567890',
};
const REMONTY = {
    name: 'Remonty Kowalski',
    slug: 'remonty-kowalski',
    category: 'renovation',
    city: 'Kraków',
    nip: null,
};

describe('filterDashboardServices', () => {
    it('zapytanie bez polskich znakow trafia nazwe z polskimi znakami', () => {
        expect(filterDashboardServices([KSIEGOWA, REMONTY], 'ksiegowa')).toEqual([KSIEGOWA]);
    });

    it('zapytanie z polskimi znakami trafia pole bez nich', () => {
        expect(filterDashboardServices([KSIEGOWA, REMONTY], 'krakow')).toEqual([REMONTY]);
        expect(filterDashboardServices([KSIEGOWA, REMONTY], 'Łódź')).toEqual([KSIEGOWA]);
    });

    it('szuka po NIP-ie', () => {
        expect(filterDashboardServices([KSIEGOWA, REMONTY], '4567')).toEqual([KSIEGOWA]);
    });

    it('puste zapytanie zwraca wszystkie wpisy', () => {
        expect(filterDashboardServices([KSIEGOWA, REMONTY], '  ')).toEqual([KSIEGOWA, REMONTY]);
    });

    it('zapytanie bez trafien zwraca pusta liste', () => {
        expect(filterDashboardServices([KSIEGOWA, REMONTY], 'fryzjer')).toEqual([]);
    });
});
