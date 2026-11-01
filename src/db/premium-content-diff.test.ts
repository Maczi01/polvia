import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { describePremiumChanges } from './premium-content-diff';
import { premiumContentSchema } from './premium-content-schema';

const CONTENT = premiumContentSchema.parse(premiumBlock());

describe('describePremiumChanges', () => {
    it('ta sama tresc: bez zmian', () => {
        expect(describePremiumChanges({ kind: 'valid', content: CONTENT }, CONTENT)).toEqual([
            'Bez zmian — tresc identyczna z zapisana w bazie.',
        ]);
    });

    it('nowa tresc: podsumowanie zamiast diffu', () => {
        const lines = describePremiumChanges({ kind: 'none' }, CONTENT);

        expect(lines[0]).toContain('Nowa tresc premium');
        expect(lines).toContain('  galeria: 1 zdjec');
    });

    it('pokazuje zmiane szablonu, dodane i usuniete zdjecia oraz poprawione tlumaczenie', () => {
        const [photo] = CONTENT.gallery;
        const [faq] = CONTENT.faq;
        const next = {
            ...CONTENT,
            template: 'professional' as const,
            gallery: [{ ...photo, file: 'nowe.jpg' }],
            faq: [{ ...faq, a: { ...faq.a, ru: 'Да, звоните.' } }],
        };

        expect(describePremiumChanges({ kind: 'valid', content: CONTENT }, next)).toEqual([
            'Zmiany wzgledem bazy:',
            '  ~ szablon: gallery -> professional',
            '  + galeria: nowe.jpg',
            '  - galeria: salon-1.webp',
            '  ~ FAQ: Czy trzeba sie umawiac?',
        ]);
    });

    it('sama zmiana kolejnosci pozycji: jedna linia o kolejnosci, bez + / -', () => {
        const [photo] = CONTENT.gallery;
        const second = { ...photo, file: 'salon-2.jpg' };
        const previous = { ...CONTENT, gallery: [photo, second] };
        const next = { ...CONTENT, gallery: [second, photo] };

        expect(describePremiumChanges({ kind: 'valid', content: previous }, next)).toEqual([
            'Zmiany wzgledem bazy:',
            '  ~ galeria: zmieniona kolejnosc',
        ]);
    });

    it('nieczytelna tresc w bazie: ostrzezenie o nadpisaniu', () => {
        expect(describePremiumChanges({ kind: 'invalid' }, CONTENT)[0]).toContain('nadpisana');
    });
});
