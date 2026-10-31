import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { toPremiumContent } from './service-profile-premium';

const SOURCE = { serviceId: 'svc-1', slug: 'salon-roza', locale: 'en', name: 'Salon Roza' };

describe('toPremiumContent', () => {
    it('brak zapisanej tresci daje null', () => {
        expect(toPremiumContent(null, SOURCE)).toBeNull();
    });

    it('locale spoza katalogu dostaje teksty domyslnego pl', () => {
        const content = toPremiumContent(premiumBlock(), { ...SOURCE, locale: 'de' });

        expect(content?.priceList).toEqual([{ name: 'Strzyzenie', price: 'od 80 zl' }]);
    });

    it('tresc niezgodna ze schematem daje null i log bez wartosci pol', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        expect(
            toPremiumContent({ template: 'gallery', gallery: [{ file: 'x' }] }, SOURCE),
        ).toBeNull();
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain('"x"');

        consoleError.mockRestore();
    });
});
