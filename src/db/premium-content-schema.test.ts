import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import {
    localizePremiumContent,
    PREMIUM_GALLERY_MAX,
    premiumContentSchema,
    premiumImageFiles,
} from './premium-content-schema';
import { serviceInputSchema } from './service-input-schema';

function galleryOf(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        file: `foto-${index}.jpg`,
        alt: { pl: 'Zdjecie', uk: 'Фото', en: 'Photo', ru: 'Фото' },
    }));
}

/** Poprawny blok po walidacji — typowany punkt wyjscia do psucia pojedynczych pol. */
const VALID = premiumContentSchema.parse(premiumBlock());

function issuePaths(input: unknown): string[] {
    const result = premiumContentSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'));
}

describe('premiumContentSchema', () => {
    it('przyjmuje poprawny blok premium', () => {
        const result = premiumContentSchema.safeParse(premiumBlock());

        expect(result.success).toBe(true);
        expect(result.success && result.data.template).toBe('gallery');
    });

    it('uzupelnia brakujace listy i cover domyslnymi pustymi wartosciami', () => {
        const result = premiumContentSchema.safeParse({ template: 'classic' });

        expect(result.success && result.data).toEqual({
            template: 'classic',
            coverImage: null,
            gallery: [],
            priceList: [],
            faq: [],
        });
    });

    it('odrzuca pozycje FAQ bez tlumaczenia ru, ze sciezka bledu', () => {
        const [faq] = VALID.faq;
        const { ru: _ru, ...withoutRu } = faq.q;

        expect(issuePaths(premiumBlock({ faq: [{ ...faq, q: withoutRu }] }))).toEqual([
            'faq.0.q.ru',
        ]);
    });

    it('odrzuca pusty tekst tlumaczenia (same spacje)', () => {
        const [item] = VALID.priceList;

        expect(
            issuePaths(
                premiumBlock({ priceList: [{ ...item, name: { ...item.name, uk: '   ' } }] }),
            ),
        ).toEqual(['priceList.0.name.uk']);
    });

    it('odrzuca nieznany szablon', () => {
        expect(issuePaths(premiumBlock({ template: 'luxury' }))).toEqual(['template']);
    });

    it(`przyjmuje galerie z ${PREMIUM_GALLERY_MAX} zdjeciami i odrzuca o jedno wiecej`, () => {
        expect(issuePaths(premiumBlock({ gallery: galleryOf(PREMIUM_GALLERY_MAX) }))).toEqual([]);
        expect(issuePaths(premiumBlock({ gallery: galleryOf(PREMIUM_GALLERY_MAX + 1) }))).toEqual([
            'gallery',
        ]);
    });

    it.each(['../../env.ts', 'podkatalog/foto.jpg', 'foto.svg', '.jpg', 'foto..jpg'])(
        'odrzuca nazwe pliku %p (sciezka albo nie-obrazek)',
        file => {
            expect(issuePaths(premiumBlock({ coverImage: file }))).toEqual(['coverImage']);
        },
    );

    it('odrzuca nieznany klucz (literowka w recznie pisanym JSON)', () => {
        expect(issuePaths(premiumBlock({ galery: [] }))).toEqual(['']);
    });
});

describe('serviceInputSchema z blokiem premium', () => {
    const entry = {
        name: 'Salon Roza',
        category: 'beauty',
        translations: {
            pl: { description: 'Salon.' },
            uk: { description: 'Салон.' },
            en: { description: 'Salon.' },
            ru: { description: 'Салон.' },
        },
        locations: [{ city: 'Warszawa', latitude: 52.23, longitude: 21.01 }],
    };

    it('nie odrzuca pliku wpisu z kluczem premium (schemat strict)', () => {
        const result = serviceInputSchema.safeParse({ ...entry, premium: premiumBlock() });

        expect(result.success && result.data.premium?.template).toBe('gallery');
    });

    it('bledny blok premium odrzuca caly wpis ze sciezka w bloku', () => {
        const result = serviceInputSchema.safeParse({
            ...entry,
            premium: premiumBlock({ template: 'x' }),
        });

        expect(result.success).toBe(false);
        expect(result.success || result.error.issues[0]?.path).toEqual(['premium', 'template']);
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
        });
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

describe('premiumImageFiles', () => {
    it('zwraca cover i pliki galerii, bez coveru gdy go brak', () => {
        expect(premiumImageFiles(VALID)).toEqual(['cover.jpg', 'salon-1.webp']);
        expect(premiumImageFiles({ ...VALID, coverImage: null })).toEqual(['salon-1.webp']);
    });
});
