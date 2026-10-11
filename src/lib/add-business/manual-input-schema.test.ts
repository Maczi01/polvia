/**
 * @jest-environment node
 */
import { MANUAL_DESCRIPTION_MAX, MANUAL_DESCRIPTION_MIN } from '@/lib/add-business/form-limits';
import { parseManualInput } from '@/lib/add-business/manual-input-schema';

const DESCRIPTION =
    'Gabinet stomatologiczny w centrum Warszawy, leczenie zachowawcze i protetyka dla dorosłych.';

function manualForm(overrides: Record<string, string | File> = {}): FormData {
    const form = new FormData();
    const fields: Record<string, string | File> = {
        name: 'Gabinet Zdrowie',
        street: 'ul. Prosta 5',
        postcode: '',
        city: 'Warszawa',
        phoneNumber: '',
        email: 'biuro@gabinet.example.pl',
        link: 'https://www.instagram.com/gabinetzdrowie',
        description: DESCRIPTION,
        ...overrides,
    };
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return form;
}

describe('parseManualInput', () => {
    it('happy path: puste pola to null, godziny otwarcia null, opis i link osobno', () => {
        const result = parseManualInput(manualForm({ description: `  ${DESCRIPTION}  ` }));

        expect(result).toEqual({
            ok: true,
            data: {
                fields: {
                    name: 'Gabinet Zdrowie',
                    street: 'ul. Prosta 5',
                    postcode: null,
                    city: 'Warszawa',
                    phoneNumber: null,
                    email: 'biuro@gabinet.example.pl',
                    openingHours: null,
                },
                description: DESCRIPTION,
                link: 'https://www.instagram.com/gabinetzdrowie',
            },
        });
    });

    it(`opis dluzszy niz ${MANUAL_DESCRIPTION_MAX} znakow to tooLong`, () => {
        const result = parseManualInput(
            manualForm({ description: 'a'.repeat(MANUAL_DESCRIPTION_MAX + 1) }),
        );

        expect(result).toEqual({
            ok: false,
            fieldErrors: { description: 'addBusiness.errors.tooLong' },
        });
    });

    it(`opis krotszy niz ${MANUAL_DESCRIPTION_MIN} znakow to tooShort`, () => {
        const result = parseManualInput(
            manualForm({ description: 'a'.repeat(MANUAL_DESCRIPTION_MIN - 1) }),
        );

        expect(result).toEqual({
            ok: false,
            fieldErrors: { description: 'addBusiness.errors.tooShort' },
        });
    });

    it('opis z samych spacji to required, nie tooShort', () => {
        const result = parseManualInput(manualForm({ description: '      ' }));

        expect(result).toEqual({
            ok: false,
            fieldErrors: { description: 'addBusiness.errors.required' },
        });
    });

    it('zly e-mail to invalidEmail', () => {
        const result = parseManualInput(manualForm({ email: 'biuro@' }));

        expect(result).toEqual({
            ok: false,
            fieldErrors: { email: 'addBusiness.errors.invalidEmail' },
        });
    });

    it.each(['javascript:alert(1)', 'ftp://gabinet.example.pl', 'gabinet.example.pl'])(
        'link %s (nie http/https) to invalidUrl',
        link => {
            const result = parseManualInput(manualForm({ link }));

            expect(result).toEqual({
                ok: false,
                fieldErrors: { link: 'addBusiness.errors.invalidUrl' },
            });
        },
    );

    it('brak nazwy i miasta to required na obu polach', () => {
        const form = manualForm({ name: ' ' });
        form.delete('city');

        const result = parseManualInput(form);

        expect(result).toEqual({
            ok: false,
            fieldErrors: {
                name: 'addBusiness.errors.required',
                city: 'addBusiness.errors.required',
            },
        });
    });

    it('File w polu tekstowym to invalidValue, nie wyjatek', () => {
        const result = parseManualInput(
            manualForm({ name: new File(['x'], 'name.txt', { type: 'text/plain' }) }),
        );

        expect(result).toEqual({
            ok: false,
            fieldErrors: { name: 'addBusiness.errors.invalidValue' },
        });
    });
});
