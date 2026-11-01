/**
 * @jest-environment node
 */
import {
    checkoutSessionIdSchema,
    invalidMaterialsFields,
    parseCheckoutForm,
    parseMaterialsForm,
    PREMIUM_MATERIALS_MAX_LENGTH,
} from './_checkout-schema';

const SERVICE_ID = '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01';

function form(fields: Record<string, string>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
}

describe('parseCheckoutForm', () => {
    it('przyjmuje uuid wpisu i interwal z allowlisty', () => {
        const result = parseCheckoutForm(form({ serviceId: SERVICE_ID, interval: 'yearly' }));

        expect(result.success && result.data).toEqual({
            serviceId: SERVICE_ID,
            interval: 'yearly',
        });
    });

    it('odrzuca interwal spoza allowlisty i brak interwalu', () => {
        expect(parseCheckoutForm(form({ serviceId: SERVICE_ID, interval: 'weekly' })).success).toBe(
            false,
        );
        expect(parseCheckoutForm(form({ serviceId: SERVICE_ID })).success).toBe(false);
    });

    it('odrzuca serviceId, ktore nie jest uuid', () => {
        expect(
            parseCheckoutForm(form({ serviceId: '1 OR 1=1', interval: 'monthly' })).success,
        ).toBe(false);
    });
});

describe('checkoutSessionIdSchema', () => {
    it('przyjmuje id sesji testowej i produkcyjnej', () => {
        expect(checkoutSessionIdSchema.safeParse('cs_test_a1B2c3').success).toBe(true);
        expect(checkoutSessionIdSchema.safeParse('cs_live_a1B2c3').success).toBe(true);
    });

    it('odrzuca inne obiekty Stripe, sciezki i tablice z query', () => {
        expect(checkoutSessionIdSchema.safeParse('sub_123').success).toBe(false);
        expect(checkoutSessionIdSchema.safeParse('cs_test_../../v1/customers').success).toBe(false);
        expect(checkoutSessionIdSchema.safeParse(['cs_test_a', 'cs_test_b']).success).toBe(false);
        expect(checkoutSessionIdSchema.safeParse(null).success).toBe(false);
    });
});

describe('parseMaterialsForm', () => {
    const valid = { sessionId: 'cs_test_a1B2c3', slug: 'mistrz-remontu', template: 'gallery' };

    it('brakujace pola tekstowe to pusty tekst, a tresc jest przycinana', () => {
        const result = parseMaterialsForm(form({ ...valid, notes: '  Prosze o kontakt  ' }));

        expect(result.success && result.data).toEqual({
            ...valid,
            priceList: '',
            faq: '',
            notes: 'Prosze o kontakt',
        });
    });

    it('tekst ponad limit i brak szablonu wskazuja widoczne pola', () => {
        const tooLong = 'x'.repeat(PREMIUM_MATERIALS_MAX_LENGTH.priceList + 1);
        const result = parseMaterialsForm(
            form({ sessionId: valid.sessionId, slug: valid.slug, priceList: tooLong }),
        );

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(invalidMaterialsFields(result.error).sort()).toEqual(['priceList', 'template']);
    });

    it('bledne pola ukryte (sesja, slug) nie sa polami formularza', () => {
        const result = parseMaterialsForm(form({ ...valid, sessionId: 'x', slug: 'Zly Slug' }));

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(invalidMaterialsFields(result.error)).toEqual([]);
    });
});
