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

describe('verifyFacts — granice slow w polach tekstowych', () => {
    const LODZ_SOURCE = 'Biuro: ul. Gdańska 5, Łódź';

    it('odrzuca miasto, ktore w zrodle jest tylko poczatkiem innego slowa', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ city: 'Gdańsk' }),
            sourceText: LODZ_SOURCE,
        });

        expect(result.facts.city).toBeNull();
        expect(result.unconfirmed).toContain('city');
    });

    it('przyjmuje miasto z polskimi znakami na granicy slowa', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ city: 'Łódź' }),
            sourceText: LODZ_SOURCE,
        });

        expect(result.facts.city).toBe('Łódź');
        expect(result.unconfirmed).not.toContain('city');
    });

    it('przyjmuje miasto zakonczone polskim znakiem przed przecinkiem', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ city: 'Łódź' }),
            sourceText: 'Łódź, ul. Piotrkowska 1',
        });

        expect(result.facts.city).toBe('Łódź');
    });

    it('odrzuca slowo, ktore w zrodle jest srodkiem dluzszego slowa z diakrytykami', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ city: 'Łódź' }),
            sourceText: 'Podłódźanie zapraszają',
        });

        expect(result.facts.city).toBeNull();
    });

    it('odrzuca ulice z numerem, ktory w zrodle jest poczatkiem dluzszego numeru', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ street: 'Prosta 1' }),
            sourceText: 'ul. Prosta 15, Warszawa',
        });

        expect(result.facts.street).toBeNull();
        expect(result.unconfirmed).toContain('street');
    });

    it('przyjmuje ulice z pelnym numerem obecnym w zrodle', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ street: 'Prosta 15' }),
            sourceText: 'ul. Prosta 15, Warszawa',
        });

        expect(result.facts.street).toBe('Prosta 15');
    });

    it('odrzuca jednoznakowa wartosc tekstowa nawet obecna w zrodle jako slowo', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ name: 'a', city: 'a' }),
            sourceText: 'Kot a pies',
        });

        expect(result.facts.name).toBeNull();
        expect(result.facts.city).toBeNull();
    });

    it('traktuje znaki regex w wartosci doslownie', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ name: 'Firma (A+B)' }),
            sourceText: 'Firma AAB oraz Firma A+B',
        });

        expect(result.facts.name).toBeNull();
    });
});

describe('verifyFacts — kod pocztowy', () => {
    it.each(['0', '00950'])('odrzuca kod pocztowy %p spoza formatu NN-NNN', postcode => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ postcode }),
            sourceText: 'ul. Prosta 0, 00950 Warszawa',
        });

        expect(result.facts.postcode).toBeNull();
        expect(result.unconfirmed).toContain('postcode');
    });

    it('przyjmuje kod pocztowy NN-NNN obecny w zrodle', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ postcode: '00-950' }),
            sourceText: 'ul. Prosta 15, 00-950 Warszawa',
        });

        expect(result.facts.postcode).toBe('00-950');
        expect(result.unconfirmed).not.toContain('postcode');
    });

    it('odrzuca kod pocztowy bedacy fragmentem dluzszego ciagu cyfr', () => {
        const result = verifyFacts({
            structured: {},
            llm: llm({ postcode: '00-950' }),
            sourceText: 'nr konta 1100-9501',
        });

        expect(result.facts.postcode).toBeNull();
    });
});
