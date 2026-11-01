import { premiumContactQuery, readContactPrefill } from './premium-contact';

describe('premiumContactQuery', () => {
    it('z profilu: temat premium i slug firmy', () => {
        expect(premiumContactQuery('kancelaria-nowak')).toEqual({
            topic: 'premium',
            firma: 'kancelaria-nowak',
        });
    });

    it('z cennika: sam temat', () => {
        expect(premiumContactQuery()).toEqual({ topic: 'premium' });
    });
});

describe('readContactPrefill', () => {
    it('odczytuje temat premium i slug firmy', () => {
        const params = new URLSearchParams(premiumContactQuery('kancelaria-nowak'));

        expect(readContactPrefill(params)).toEqual({ kind: 'premium', slug: 'kancelaria-nowak' });
    });

    it('temat premium bez firmy', () => {
        expect(readContactPrefill(new URLSearchParams('topic=premium'))).toEqual({
            kind: 'premium',
            slug: null,
        });
    });

    it('slug spoza formatu nie trafia do wiadomosci', () => {
        const params = new URLSearchParams({ topic: 'premium', firma: 'Zla firma <b>' });

        expect(readContactPrefill(params)).toEqual({ kind: 'premium', slug: null });
    });

    it('brak albo inny temat: bez wypelnienia', () => {
        expect(readContactPrefill(new URLSearchParams())).toBeNull();
        expect(readContactPrefill(new URLSearchParams('topic=reklama&firma=roza'))).toBeNull();
    });
});
