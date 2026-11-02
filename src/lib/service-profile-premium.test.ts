import { premiumContentSchema } from '@/db/premium-content-schema';

import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { localizePremiumContent, toPremiumContent } from './service-profile-premium';

const VALID = premiumContentSchema.parse(premiumBlock());

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

describe('localizePremiumContent', () => {
    const content = VALID;

    it('rozwiazuje teksty dla locale i sklada sciezki /services/<slug>/<plik>', () => {
        const localized = localizePremiumContent(content, {
            serviceSlug: 'salon-roza',
            locale: 'uk',
            coverAlt: 'Салон Роза',
        });

        expect(localized).toEqual({
            template: 'gallery',
            coverImage: { src: '/services/salon-roza/cover.jpg', alt: 'Салон Роза' },
            gallery: [{ src: '/services/salon-roza/salon-1.webp', alt: 'Інтерʼєр салону' }],
            priceList: [{ name: 'Стрижка', price: 'від 80 зл' }],
            faq: [{ question: 'Чи потрібно записуватися?', answer: 'Так, телефоном.' }],
            ratings: [],
        });
    });

    it('oceny: nazwa znanego serwisu ze stalej, serwisu "other" z label', () => {
        const parsed = premiumContentSchema.parse({
            ...content,
            ratings: [
                { source: 'booksy', rating: 4.9, count: 210, url: 'https://booksy.com/x' },
                {
                    source: 'other',
                    label: 'Oferteo',
                    rating: 4,
                    count: 3,
                    url: 'https://oferteo.pl/x',
                },
            ],
        });

        const localized = localizePremiumContent(parsed, {
            serviceSlug: 'salon-roza',
            locale: 'pl',
            coverAlt: 'Salon Roza',
        });

        expect(localized.ratings).toEqual([
            {
                source: 'booksy',
                name: 'Booksy',
                rating: 4.9,
                count: 210,
                url: 'https://booksy.com/x',
            },
            { source: 'other', name: 'Oferteo', rating: 4, count: 3, url: 'https://oferteo.pl/x' },
        ]);
    });

    it('przenosi notatke cennika tylko, gdy jest w danych', () => {
        const [item] = content.priceList;
        const withNote = {
            ...content,
            priceList: [
                { ...item, note: { pl: 'Notatka', uk: 'Примітка', en: 'Note', ru: 'Заметка' } },
            ],
        };

        const localized = localizePremiumContent(withNote, {
            serviceSlug: 's',
            locale: 'en',
            coverAlt: '',
        });

        expect(localized.priceList).toEqual([
            { name: 'Haircut', price: 'from 80 PLN', note: 'Note' },
        ]);
    });
});
