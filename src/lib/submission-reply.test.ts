/**
 * @jest-environment node
 */
import { buildSubmissionReplyDraft } from './submission-reply';

const mockLimit = jest.fn();

jest.mock('@/db', () => ({
    db: {
        select: () => ({
            from: () => ({ where: () => ({ limit: (count: number) => mockLimit(count) }) }),
        }),
    },
}));

const NO_CONSENT = { premiumInfoConsent: false };

describe('buildSubmissionReplyDraft', () => {
    beforeEach(() => {
        mockLimit.mockReset();
        mockLimit.mockResolvedValue([{ slug: 'kancelaria-nowak' }]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        ['pl', 'https://www.polvia.pl/cennik'],
        ['en', 'https://www.polvia.pl/en/pricing'],
        ['ru', 'https://www.polvia.pl/ru/pricing'],
        ['uk', 'https://www.polvia.pl/uk/pricing'],
    ])('zgoda (%s): akapit o premium z cennikiem w jezyku odbiorcy', async (locale, url) => {
        const draft = await buildSubmissionReplyDraft({
            name: 'Kancelaria Nowak',
            locale,
            premiumInfoConsent: true,
        });

        expect(draft.text).toContain(url);
    });

    it.each(['pl', 'en', 'ru', 'uk'])('brak zgody (%s): zadnej wzmianki o premium', async locale => {
        const draft = await buildSubmissionReplyDraft({
            name: 'Kancelaria Nowak',
            locale,
            ...NO_CONSENT,
        });

        expect(draft.text).not.toMatch(/premium|преміум|премиум|cennik|pricing/i);
        expect(draft.text).not.toContain('{premium}');
    });

    it('akapit o premium stoi przed podpisem i nie zostawia pustych linii', async () => {
        const draft = await buildSubmissionReplyDraft({
            name: 'Kancelaria Nowak',
            locale: 'pl',
            premiumInfoConsent: true,
        });

        expect(draft.text.indexOf('cennik')).toBeLessThan(draft.text.indexOf('Zespół Polvia'));
        expect(draft.text).not.toMatch(/\n{3}/);
    });

    it('wypelnia po polsku nazwe i produkcyjny link bez prefiksu', async () => {
        const draft = await buildSubmissionReplyDraft({
            name: 'Kancelaria Nowak',
            locale: 'pl',
            ...NO_CONSENT,
        });

        expect(draft.subject).toBe('Firma Kancelaria Nowak jest już w katalogu Polvia');
        expect(draft.text).toContain('dodaliśmy firmę Kancelaria Nowak');
        expect(draft.text).toContain('https://www.polvia.pl/firma/kancelaria-nowak');
        expect(draft.text).not.toContain('localhost');
        expect(draft.hasLink).toBe(true);
    });

    it.each([
        ['en', 'https://www.polvia.pl/en/firma/kancelaria-nowak', 'Kancelaria Nowak is now listed'],
        ['ru', 'https://www.polvia.pl/ru/firma/kancelaria-nowak', 'Компания Kancelaria Nowak'],
        ['uk', 'https://www.polvia.pl/uk/firma/kancelaria-nowak', 'Компанія Kancelaria Nowak'],
    ])('dla %s pisze w jezyku zglaszajacego i linkuje jego wersje', async (locale, url, subject) => {
        const draft = await buildSubmissionReplyDraft({
            name: 'Kancelaria Nowak',
            locale,
            ...NO_CONSENT,
        });

        expect(draft.subject).toContain(subject);
        expect(draft.text).toContain(url);
    });

    it('nieznane locale daje polski tekst', async () => {
        const draft = await buildSubmissionReplyDraft({
            name: 'Firma',
            locale: 'de',
            ...NO_CONSENT,
        });

        expect(draft.text).toContain('Dzień dobry');
    });

    it.each([
        ['brak wpisu', []],
        ['dwa wpisy o tej samej nazwie', [{ slug: 'a' }, { slug: 'b' }]],
    ])('%s zostawia znacznik zamiast zgadywac link', async (_name, rows) => {
        mockLimit.mockResolvedValue(rows);

        const draft = await buildSubmissionReplyDraft({
            name: 'Firma',
            locale: 'pl',
            ...NO_CONSENT,
        });

        expect(draft.text).toContain('[LINK]');
        expect(draft.text).not.toContain('polvia.pl/firma');
        expect(draft.hasLink).toBe(false);
    });

    it('blad bazy zostawia znacznik i nie wywraca strony', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockLimit.mockRejectedValue(new Error('params: firma'));

        const draft = await buildSubmissionReplyDraft({
            name: 'Firma',
            locale: 'pl',
            ...NO_CONSENT,
        });

        expect(draft.hasLink).toBe(false);
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain('params');
    });
});
