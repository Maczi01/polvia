/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import {
    DRAFT,
    harness,
    IP,
    operatorEntry,
    STORED,
    submitForm,
} from '../../../tests/fixtures/add-business/submit-draft-harness';
import { saveDraft } from './draft-store';
import { submitDraft } from './submit-draft';

/** Reczna pinezka (C), social media (A) i checkbox godzin (B) na sciezce wysylki. */

const mockRedis = createFakeRedis();

jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

jest.mock('../../../env', () => ({
    env: { MY_GMAIL: 'operator@example.com', MY_GMAIL_PASSWORD: 'app-password' },
}));

beforeEach(() => {
    mockRedis.reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

function firstLocation(sendMail: jest.Mock): Record<string, unknown> {
    const { locations } = operatorEntry(sendMail);
    if (!Array.isArray(locations)) throw new Error('JSON wpisu bez locations');
    return locations[0];
}

function operatorText(sendMail: jest.Mock): string {
    return sendMail.mock.calls[0][0].text;
}

describe('submitDraft — reczna pinezka', () => {
    it('pin wlasciciela daje wspolrzedne wpisu bez geokodowania, nawet po zmianie adresu', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);

        const result = await submitDraft(
            {
                formData: submitForm(draftId, {
                    street: 'ul. Nowa 9',
                    city: 'Kraków',
                    pinLat: '50.0614',
                    pinLng: '19.9366',
                }),
                ip: IP,
            },
            h.deps,
        );

        expect(result).toMatchObject({
            status: 'sent',
            pin: { lat: 50.0614, lng: 19.9366, approximate: false },
        });
        expect(h.geocode).not.toHaveBeenCalled();
        const location = firstLocation(h.sendMail);
        expect(location).toMatchObject({ latitude: 50.0614, longitude: 19.9366 });
        // Zmieniony adres: wojewodztwo ze szkicu (Warszawa) nie pasuje do pinu w Krakowie.
        expect(location.voivodeship).toBeUndefined();
        const text = operatorText(h.sendMail);
        expect(text).toContain('Pinezka ustawiona ręcznie przez właściciela — sprawdź przed db:add');
        expect(text).not.toContain('Brak współrzędnych');
    });

    it('zasieg online ignoruje pin: brak wspolrzednych i adnotacji', async () => {
        const h = harness();
        const draftId = await saveDraft({
            ...STORED,
            draft: { ...DRAFT, coverage: 'online' },
            geo: null,
        });

        const result = await submitDraft(
            { formData: submitForm(draftId, { pinLat: '52.1', pinLng: '21.1' }), ip: IP },
            h.deps,
        );

        expect(result).toMatchObject({ status: 'sent', pin: null });
        const location = firstLocation(h.sendMail);
        expect(location.latitude).toBeUndefined();
        expect(operatorText(h.sendMail)).not.toContain('Pinezka ustawiona ręcznie');
    });

    it('pin poza Polska to blad pola bez zuzycia szkicu i bez maila', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);

        const result = await submitDraft(
            { formData: submitForm(draftId, { pinLat: '48.85', pinLng: '2.35' }), ip: IP },
            h.deps,
        );

        expect(result).toEqual({
            status: 'invalid',
            fieldErrors: { pin: 'addBusiness.errors.pinOutsidePoland' },
        });
        expect(h.sendMail).not.toHaveBeenCalled();
    });
});

describe('submitDraft — social media i godziny', () => {
    it('socials i numer WhatsApp trafiaja do JSON-a i maila operatora', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);

        await submitDraft(
            {
                formData: submitForm(draftId, {
                    'socials.instagram': '@nowak',
                    'socials.telegram': 'https://t.me/nowak_law',
                    whatsappNumber: '500 600 700',
                }),
                ip: IP,
            },
            h.deps,
        );

        const location = firstLocation(h.sendMail);
        expect(location).toMatchObject({
            socials: {
                instagram: 'https://www.instagram.com/nowak/',
                telegram: 'https://t.me/nowak_law',
            },
            whatsappNumber: '+48500600700',
        });
        const text = operatorText(h.sendMail);
        expect(text).toContain('- instagram: https://www.instagram.com/nowak/');
        expect(text).toContain('WhatsApp (numer): +48500600700');
    });

    it('bez hoursEnabled godziny z formularza nie trafiaja do wpisu', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);

        await submitDraft(
            {
                formData: submitForm(draftId, {
                    'hours.monday.open': '09:00',
                    'hours.monday.close': '17:00',
                }),
                ip: IP,
            },
            h.deps,
        );

        const location = firstLocation(h.sendMail);
        expect(location.openingHours).toBeUndefined();
    });
});
