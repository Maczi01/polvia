/**
 * @jest-environment node
 */
import {
    buildOperatorEmail,
    buildOwnerConfirmationEmail,
    type BuiltServiceEntry,
    type SubmissionEmailInput,
} from '@/lib/add-business/submission-emails';

import pl from '../../../messages/pl.json';
import uk from '../../../messages/uk.json';

jest.mock('../../../env', () => ({
    env: { MY_GMAIL: 'operator@example.com', MY_GMAIL_PASSWORD: 'app-password' },
}));

const ENTRY: BuiltServiceEntry = {
    ok: true,
    slug: 'kancelaria-nowak',
    json: {
        name: 'Kancelaria Nowak',
        category: 'law',
        coverage: 'hybrid',
        status: 'active',
        verified: false,
        image: 'kancelaria-nowak.png',
        languages: ['pl', 'uk'],
        translations: {
            pl: { description: 'Kancelaria prawna w Warszawie.' },
            uk: { description: 'Юридична фірма у Варшаві.' },
            en: { description: 'Law firm in Warsaw.' },
            ru: { description: 'Юридическая фирма в Варшаве.' },
        },
        tags: [{ pl: 'Prawo pracy', uk: 'Трудове право', en: 'Labour law', ru: 'Трудовое право' }],
        locations: [
            {
                city: 'Warszawa',
                street: 'ul. Prosta 1',
                postcode: '00-001',
                latitude: 52.2297,
                longitude: 21.0122,
                openingHours: { monday: { open: '09:00', close: '17:00' } },
                phoneNumber: '+48 500 600 700',
                webpage: 'https://nowak.pl/',
                isMainLocation: true,
            },
        ],
    },
    unconfirmed: ['email', 'street'],
    changedByOwner: ['phoneNumber'],
    missingCoordinates: false,
};

const LOGO = Buffer.from('png-bytes');

function input(overrides: Partial<SubmissionEmailInput> = {}): SubmissionEmailInput {
    return {
        entry: ENTRY,
        stored: { locale: 'pl', source: 'page', sourceUrl: 'https://nowak.pl/' },
        submitterEmail: 'wlasciciel@nowak.pl',
        notes: 'Prosze o dodanie godzin w sobote.',
        logo: LOGO,
        manualPin: false,
        ...overrides,
    };
}

function sectionBody(text: string, title: string): string {
    const start = text.indexOf(`== ${title} ==`);
    if (start === -1) return '';
    const end = text.indexOf('\n\n', start);
    return text.slice(start, end === -1 ? undefined : end);
}

describe('buildOperatorEmail', () => {
    it('zawiera niepotwierdzone pola, uwagi i dwa zalaczniki z parsowalnym JSON-em', () => {
        const mail = buildOperatorEmail(input());

        expect(mail.to).toBe('operator@example.com');
        expect(mail.replyTo).toBe('wlasciciel@nowak.pl');
        expect(sectionBody(mail.text, 'Niepotwierdzone')).toContain('email');
        expect(sectionBody(mail.text, 'Niepotwierdzone')).toContain('street');
        expect(sectionBody(mail.text, 'Zmienione przez właściciela')).toContain('phoneNumber');
        expect(sectionBody(mail.text, 'Uwagi')).toContain('Prosze o dodanie godzin w sobote.');
        expect(mail.text).toContain(
            'npm run db:add -- data/services/kancelaria-nowak.json --dry-run',
        );

        const names = mail.attachments?.map(attachment => attachment.filename);
        expect(names).toEqual(['kancelaria-nowak.json', 'kancelaria-nowak.png']);
        const json = mail.attachments?.[0]?.content;
        expect(typeof json === 'string' && JSON.parse(json)).toEqual(ENTRY.json);
        expect(mail.attachments?.[1]?.content).toBe(LOGO);
    });

    it('bez logo wysyla jeden zalacznik i sekcje "Brak logo"', () => {
        const mail = buildOperatorEmail(input({ logo: null }));

        expect(mail.attachments?.map(attachment => attachment.filename)).toEqual([
            'kancelaria-nowak.json',
        ]);
        expect(mail.text).toContain('== Brak logo ==');
        expect(mail.text).not.toContain('public/services/kancelaria-nowak.png');
    });

    it('z logo i wspolrzednymi nie ma sekcji ostrzezen', () => {
        const { text } = buildOperatorEmail(input());

        expect(text).not.toContain('== Brak logo ==');
        expect(text).not.toContain('== Brak współrzędnych ==');
    });

    it('brak wspolrzednych i tryb reczny trafiaja do tresci', () => {
        const mail = buildOperatorEmail(
            input({
                entry: { ...ENTRY, missingCoordinates: true },
                stored: { locale: 'uk', source: 'owner', sourceUrl: null },
                notes: null,
            }),
        );

        expect(mail.text).toContain('== Brak współrzędnych ==');
        expect(sectionBody(mail.text, 'Źródło')).toContain('ręczny');
        expect(sectionBody(mail.text, 'Uwagi')).toContain('(brak)');
    });

    it('nazwa firmy z \\r\\n daje temat bez znakow nowej linii', () => {
        const entry = { ...ENTRY, json: { ...ENTRY.json, name: 'Nowak\r\nBcc: x@evil.com' } };

        const { subject } = buildOperatorEmail(input({ entry }));

        expect(subject).not.toMatch(/[\r\n]/);
        expect(subject).toBe('[Polvia] Zgłoszenie: Nowak Bcc: x@evil.com');
    });
});

describe('buildOwnerConfirmationEmail', () => {
    it('dla uk uzywa tekstow z messages/uk.json, nie polskich', () => {
        const mail = buildOwnerConfirmationEmail(
            input({ stored: { ...input().stored, locale: 'uk' } }),
        );
        const ukTexts = uk.addBusiness.confirmationEmail;
        const plTexts = pl.addBusiness.confirmationEmail;

        expect(mail.to).toBe('wlasciciel@nowak.pl');
        expect(mail.subject).toBe('Ми отримали заявку: Kancelaria Nowak');
        expect(mail.text).toContain(ukTexts.review);
        expect(mail.text).toContain(`${ukTexts.days.monday}: 09:00-17:00`);
        expect(mail.text).toContain(`${ukTexts.languages.pl}, ${ukTexts.languages.uk}`);
        expect(mail.text).not.toContain(plTexts.review);
    });

    it('zawiera fakty, ale nie opisy w czterech jezykach', () => {
        const { text } = buildOwnerConfirmationEmail(input());

        expect(text).toContain('ul. Prosta 1, 00-001 Warszawa');
        expect(text).toContain('+48 500 600 700');
        expect(text).not.toContain('Kancelaria prawna w Warszawie.');
        expect(text).not.toContain('Law firm in Warsaw.');
    });

    it('nazwa z \\r\\n nie wstrzykuje naglowka do tematu', () => {
        const entry = { ...ENTRY, json: { ...ENTRY.json, name: 'Nowak\r\nBcc: x@evil.com' } };

        const { subject } = buildOwnerConfirmationEmail(input({ entry }));

        expect(subject).not.toMatch(/[\r\n]/);
    });
});
