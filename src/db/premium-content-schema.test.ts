import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import {
    PREMIUM_FAQ_MAX,
    PREMIUM_GALLERY_MAX,
    PREMIUM_PRICE_LIST_MAX,
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

    it('przyjmuje activeUntil (premium reczne) jako date RRRR-MM-DD', () => {
        const result = premiumContentSchema.safeParse(premiumBlock({ activeUntil: '2026-11-30' }));

        expect(result.success && result.data.activeUntil).toBe('2026-11-30');
    });

    it.each(['2026-02-30', '30.11.2026', '2026-11-30T23:59:59Z', ''])(
        'odrzuca activeUntil %p ze sciezka bledu',
        activeUntil => {
            expect(issuePaths(premiumBlock({ activeUntil }))).toEqual(['activeUntil']);
        },
    );

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

    it(`odrzuca cennik ponad ${PREMIUM_PRICE_LIST_MAX} i FAQ ponad ${PREMIUM_FAQ_MAX} pozycji`, () => {
        const [price] = VALID.priceList;
        const [faq] = VALID.faq;
        const priceList = Array.from({ length: PREMIUM_PRICE_LIST_MAX + 1 }, (_, index) => ({
            ...price,
            name: { pl: `p${index}`, uk: `u${index}`, en: `e${index}`, ru: `r${index}` },
        }));
        const faqs = Array.from({ length: PREMIUM_FAQ_MAX + 1 }, (_, index) => ({
            ...faq,
            q: { pl: `p${index}`, uk: `u${index}`, en: `e${index}`, ru: `r${index}` },
        }));

        expect(issuePaths(premiumBlock({ priceList: priceList.slice(0, -1) }))).toEqual([]);
        expect(issuePaths(premiumBlock({ priceList }))).toEqual(['priceList']);
        expect(issuePaths(premiumBlock({ faq: faqs.slice(0, -1) }))).toEqual([]);
        expect(issuePaths(premiumBlock({ faq: faqs }))).toEqual(['faq']);
    });

    it('odrzuca powtorzony plik galerii ze sciezka na duplikacie', () => {
        const [item] = VALID.gallery;

        expect(issuePaths(premiumBlock({ gallery: [item, { ...item }] }))).toEqual([
            'gallery.1.file',
        ]);
    });

    it('odrzuca powtorzona nazwe w cenniku tylko w locale, w ktorym sie powtarza', () => {
        const [item] = VALID.priceList;
        const other = { ...item, name: { ...item.name, pl: 'Farbowanie', en: 'Colouring' } };
        const duplicateUk = { ...other, name: { ...other.name, ru: 'Окрашивание' } };

        expect(issuePaths(premiumBlock({ priceList: [item, duplicateUk] }))).toEqual([
            'priceList.1.name.uk',
        ]);
    });

    it('odrzuca powtorzone pytanie FAQ w kazdym locale, w ktorym sie powtarza', () => {
        const [item] = VALID.faq;

        expect(issuePaths(premiumBlock({ faq: [item, { ...item }] }))).toEqual([
            'faq.1.q.pl',
            'faq.1.q.en',
            'faq.1.q.ru',
            'faq.1.q.uk',
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

describe('premiumImageFiles', () => {
    it('zwraca cover i pliki galerii, bez coveru gdy go brak', () => {
        expect(premiumImageFiles(VALID)).toEqual(['cover.jpg', 'salon-1.webp']);
        expect(premiumImageFiles({ ...VALID, coverImage: null })).toEqual(['salon-1.webp']);
    });
});
