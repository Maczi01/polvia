import type { LlmFacts } from './draft-schema';
import { verifyFacts } from './verify-facts';

const NO_FACTS: LlmFacts = {
    name: null,
    street: null,
    postcode: null,
    city: null,
    phone: null,
    email: null,
    openingHours: null,
};

function llm(facts: Partial<LlmFacts>): LlmFacts {
    return { ...NO_FACTS, ...facts };
}

describe('verifyFacts — telefon', () => {
    it('odrzuca telefon od modelu, ktorego nie ma w tekscie zrodla', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ phone: '+48 600 100 200' }),
            sourceText: 'Zapraszamy, tel. 22 123 45 67',
        });

        expect(result.facts.phoneNumber).toBeNull();
        expect(result.unconfirmed).toContain('phoneNumber');
    });

    it('fakt z JSON-LD wygrywa z odpowiedzia modelu', () => {
        const result = verifyFacts({
            structured: { telephone: '+48 22 111 11 11' },
            llm: llm({ phone: '22 222 22 22' }),
            sourceText: 'tel. 22 111 11 11, fax 22 222 22 22',
        });

        expect(result.facts.phoneNumber).toBe('+48 22 111 11 11');
        expect(result.unconfirmed).not.toContain('phoneNumber');
    });

    it('przyjmuje telefon zgodny ze zrodlem po normalizacji cyfr i prefiksu +48', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ phone: '221234567' }),
            sourceText: 'Kontakt: +48 22 123-45-67 (pn-pt)',
        });

        expect(result.facts.phoneNumber).toBe('221234567');
        expect(result.unconfirmed).not.toContain('phoneNumber');
    });

    it('nie sklada numeru z cyfr dwoch odleglych liczb', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ phone: '221234567' }),
            sourceText: 'ul. Prosta 22, lokal nr 1234567',
        });

        expect(result.facts.phoneNumber).toBeNull();
    });

    it.each(['221234567', '600700800'])(
        'rozpoznaje %p wsrod dwoch numerow stojacych obok siebie w stopce',
        phone => {
            const result = verifyFacts({
                structured: {},
                llm: llm({ phone }),
                sourceText: 'Kontakt: 22 123 45 67 600 700 800',
            });

            expect(result.facts.phoneNumber).toBe(phone);
            expect(result.unconfirmed).not.toContain('phoneNumber');
        },
    );

    it('rozpoznaje telefon, po ktorym stoi kod pocztowy', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ phone: '600700800' }),
            sourceText: 'Tel. 600 700 800 00-950 Warszawa',
        });

        expect(result.facts.phoneNumber).toBe('600700800');
    });

    it('odrzuca telefon nieobecny wsrod sasiadujacych numerow', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ phone: '123456789' }),
            sourceText: 'Kontakt: 22 123 45 67 600 700 800',
        });

        expect(result.facts.phoneNumber).toBeNull();
        expect(result.unconfirmed).toContain('phoneNumber');
    });

    it('odrzuca telefon od modelu z doklejonym tekstem, choc cyfry zgadzaja sie ze zrodlem', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ phone: '123 456 789 – zadzwoń, wygrałeś' }),
            sourceText: 'tel. 123 456 789',
        });

        expect(result.facts.phoneNumber).toBeNull();
    });
});

describe('verifyFacts — e-mail', () => {
    it('przyjmuje e-mail obecny w zrodle bez wzgledu na wielkosc liter', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ email: 'Biuro@Firma.pl' }),
            sourceText: 'Pisz na BIURO@firma.pl.',
        });

        expect(result.facts.email).toBe('biuro@firma.pl');
        expect(result.unconfirmed).not.toContain('email');
    });

    it('odrzuca e-mail, ktorego nie ma w zrodle', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ email: 'kontakt@firma.pl' }),
            sourceText: 'Pisz na biuro@firma.pl',
        });

        expect(result.facts.email).toBeNull();
        expect(result.unconfirmed).toContain('email');
    });

    it('e-mail z JSON-LD wygrywa', () => {
        const result = verifyFacts({
            structured: { email: 'jsonld@firma.pl' },
            llm: llm({ email: 'biuro@firma.pl' }),
            sourceText: 'biuro@firma.pl',
        });

        expect(result.facts.email).toBe('jsonld@firma.pl');
    });
});

describe('verifyFacts — nazwa i adres', () => {
    it('przyjmuje pola tekstowe obecne w zrodle mimo innej wielkosci liter i bialych znakow', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({
                name: 'Kancelaria Nowak',
                street: 'ul. Marszałkowska 10',
                postcode: '00-590',
                city: 'Warszawa',
            }),
            sourceText: 'KANCELARIA  NOWAK — ul.  Marszałkowska 10, 00-590 WARSZAWA',
        });

        expect(result.facts).toMatchObject({
            name: 'Kancelaria Nowak',
            street: 'ul. Marszałkowska 10',
            postcode: '00-590',
            city: 'Warszawa',
        });
        expect(result.unconfirmed).not.toContain('name');
        expect(result.unconfirmed).not.toContain('street');
        expect(result.unconfirmed).not.toContain('postcode');
        expect(result.unconfirmed).not.toContain('city');
    });

    it('odrzuca adres wymyslony przez model', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ street: 'ul. Prosta 5', postcode: '00-001', city: 'Kraków' }),
            sourceText: 'Biuro w Warszawie, ul. Krzywa 7',
        });

        expect(result.facts).toMatchObject({ street: null, postcode: null, city: null });
        expect(result.unconfirmed).toEqual(expect.arrayContaining(['street', 'postcode', 'city']));
    });

    it('nazwa i adres z JSON-LD wygrywaja', () => {
        const result = verifyFacts({
            structured: {
                name: 'Kancelaria Nowak sp. k.',
                address: { street: 'Marszałkowska 10', city: 'Warszawa', postcode: '00-590' },
            },
            llm: llm({ name: 'Nowak', street: 'ul. Inna 1', city: 'Kraków', postcode: '30-001' }),
            sourceText: 'Nowak, ul. Inna 1, 30-001 Kraków',
        });

        expect(result.facts).toMatchObject({
            name: 'Kancelaria Nowak sp. k.',
            street: 'Marszałkowska 10',
            postcode: '00-590',
            city: 'Warszawa',
        });
    });

    it('adres z JSON-LD podany jednym napisem potwierdza pola od modelu', () => {
        const result = verifyFacts({
            structured: { address: { raw: 'ul. Prosta 5, 00-001 Warszawa' } },
            llm: llm({ street: 'ul. Prosta 5', postcode: '00-001', city: 'Warszawa' }),
            sourceText: 'Zapraszamy',
        });

        expect(result.facts).toMatchObject({
            street: 'ul. Prosta 5',
            postcode: '00-001',
            city: 'Warszawa',
        });
    });
});

describe('verifyFacts — godziny otwarcia', () => {
    const WEEK_CLOSED = {
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
    };

    it('przyjmuje godziny obecne w zrodle, pomija dni nieczynne i dopelnia format HH:MM', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({
                openingHours: {
                    ...WEEK_CLOSED,
                    monday: { open: '9:00', close: '17:00' },
                    saturday: { open: '10:00', close: '14:30' },
                },
            }),
            sourceText: 'Pn-Pt 9:00 - 17:00, Sob 10.00-14.30',
        });

        expect(result.facts.openingHours).toEqual({
            monday: { open: '09:00', close: '17:00' },
            saturday: { open: '10:00', close: '14:30' },
        });
        expect(result.unconfirmed).not.toContain('openingHours');
    });

    it('odrzuca cale godziny, gdy choc jedna godzina nie wystepuje w zrodle', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({
                openingHours: {
                    ...WEEK_CLOSED,
                    monday: { open: '09:00', close: '17:00' },
                    friday: { open: '09:00', close: '20:00' },
                },
            }),
            sourceText: 'Pn-Pt 9:00 - 17:00',
        });

        expect(result.facts.openingHours).toBeNull();
        expect(result.unconfirmed).toContain('openingHours');
    });

    it('odrzuca godziny w zlym formacie', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({
                openingHours: { ...WEEK_CLOSED, monday: { open: '25:00', close: 'rano' } },
            }),
            sourceText: '25:00 rano',
        });

        expect(result.facts.openingHours).toBeNull();
    });

    it('godziny z JSON-LD wygrywaja', () => {
        const result = verifyFacts({
            structured: { openingHours: { monday: { open: '08:00', close: '16:00' } } },
            llm: llm({
                openingHours: { ...WEEK_CLOSED, monday: { open: '09:00', close: '17:00' } },
            }),
            sourceText: '9:00 17:00',
        });

        expect(result.facts.openingHours).toEqual({ monday: { open: '08:00', close: '16:00' } });
    });
});

describe('verifyFacts — lista niepotwierdzonych', () => {
    it('wymienia kazde pole bez potwierdzonej wartosci nazwami pol serviceInputSchema', () => {
        const result = verifyFacts({ structured: {}, llm: NO_FACTS, sourceText: 'cokolwiek' });

        expect(result.unconfirmed).toEqual([
            'name',
            'street',
            'postcode',
            'city',
            'phoneNumber',
            'email',
            'openingHours',
        ]);
    });
});
