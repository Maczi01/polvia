/**
 * @jest-environment node
 */
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { SubmissionEmailInput } from '@/lib/add-business/submission-email-format';

import {
    deleteExpiredServiceSubmissions,
    deleteServiceSubmission,
    getServiceSubmission,
    getServiceSubmissionLogo,
    markServiceSubmissionReplySent,
    saveServiceSubmission,
    setServiceSubmissionStatus,
    SUBMISSION_SAVE_TIMEOUT_MS,
} from './service-submissions';

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';
const LOGO = Buffer.from('png-bytes');
const JSON_ENTRY: SubmissionEmailInput['entry']['json'] = {
    name: 'Kancelaria Nowak',
    category: 'law',
    translations: {
        pl: { description: 'pl' },
        uk: { description: 'uk' },
        en: { description: 'en' },
        ru: { description: 'ru' },
    },
    locations: [{ city: 'Warszawa' }],
};

const mockDb = { insert: jest.fn(), select: jest.fn(), update: jest.fn(), delete: jest.fn() };

jest.mock('@/db', () => ({
    get db() {
        return mockDb;
    },
}));

const INPUT: SubmissionEmailInput = {
    entry: {
        ok: true,
        slug: 'kancelaria-nowak',
        json: JSON_ENTRY,
        unconfirmed: ['email'],
        changedByOwner: ['phoneNumber'],
        missingCoordinates: true,
    },
    stored: { locale: 'uk', source: 'page', sourceUrl: 'https://nowak.pl/' },
    submitterEmail: 'wlasciciel@nowak.pl',
    notes: 'Uwagi',
    premiumInfoConsent: true,
    logo: LOGO,
    manualPin: true,
};

function mockInsertResult(returning: () => Promise<unknown>): jest.Mock {
    const values = jest.fn(() => ({ returning }));
    mockDb.insert.mockReturnValue({ values });
    return values;
}

function mockSelectRows(rows: unknown[]): void {
    const limit = jest.fn().mockResolvedValue(rows);
    const where = jest.fn(() => ({ limit }));
    mockDb.select.mockReturnValue({ from: () => ({ where }) });
}

function mockUpdateRows(rows: unknown[]): jest.Mock {
    const set = jest.fn(() => ({
        where: () => ({ returning: jest.fn().mockResolvedValue(rows) }),
    }));
    mockDb.update.mockReturnValue({ set });
    return set;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('saveServiceSubmission', () => {
    it('zapisuje wpis, flagi, dane zglaszajacego i logo, zwraca id', async () => {
        const values = mockInsertResult(async () => [{ id: ID }]);

        await expect(saveServiceSubmission(INPUT)).resolves.toEqual({ ok: true, id: ID });

        expect(values).toHaveBeenCalledWith({
            name: 'Kancelaria Nowak',
            slug: 'kancelaria-nowak',
            entry: JSON_ENTRY,
            unconfirmed: ['email'],
            changedByOwner: ['phoneNumber'],
            missingCoordinates: true,
            manualPin: true,
            submitterEmail: 'wlasciciel@nowak.pl',
            notes: 'Uwagi',
            premiumInfoConsent: true,
            locale: 'uk',
            source: 'page',
            sourceUrl: 'https://nowak.pl/',
            logo: LOGO,
        });
    });

    it('blad bazy daje ok: false i log bez danych osobowych', async () => {
        mockInsertResult(async () => {
            throw new Error('insert failed, params: wlasciciel@nowak.pl');
        });

        await expect(saveServiceSubmission(INPUT)).resolves.toEqual({ ok: false });

        const logged = JSON.stringify(jest.mocked(console.error).mock.calls);
        expect(logged).toContain('kancelaria-nowak');
        expect(logged).not.toContain('wlasciciel@nowak.pl');
    });

    it('zawieszona baza konczy sie ok: false po limicie czasu', async () => {
        jest.useFakeTimers();
        mockInsertResult(() => new Promise(() => {}));

        const result = saveServiceSubmission(INPUT);
        await jest.advanceTimersByTimeAsync(SUBMISSION_SAVE_TIMEOUT_MS);

        await expect(result).resolves.toEqual({ ok: false });
    });
});

describe('getServiceSubmission', () => {
    it('zwraca wiersz po id', async () => {
        mockSelectRows([{ id: ID, name: 'Kancelaria Nowak' }]);
        await expect(getServiceSubmission(ID)).resolves.toEqual({
            id: ID,
            name: 'Kancelaria Nowak',
        });
    });

    it('id spoza formatu UUID daje null bez zapytania do bazy', async () => {
        await expect(getServiceSubmission('nie-uuid')).resolves.toBeNull();
        expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('brak wiersza daje null', async () => {
        mockSelectRows([]);
        await expect(getServiceSubmission(ID)).resolves.toBeNull();
    });
});

describe('getServiceSubmissionLogo', () => {
    it('zwraca bajty logo i slug', async () => {
        mockSelectRows([{ slug: 'kancelaria-nowak', logo: LOGO }]);
        await expect(getServiceSubmissionLogo(ID)).resolves.toEqual({
            slug: 'kancelaria-nowak',
            logo: LOGO,
        });
    });

    it('zgloszenie bez logo daje null', async () => {
        mockSelectRows([{ slug: 'kancelaria-nowak', logo: null }]);
        await expect(getServiceSubmissionLogo(ID)).resolves.toBeNull();
    });
});

describe('deleteServiceSubmission', () => {
    function mockDeleteRows(rows: unknown[]): void {
        mockDb.delete.mockReturnValue({
            where: () => ({ returning: jest.fn().mockResolvedValue(rows) }),
        });
    }

    it('usuwa zgloszenie i zwraca true', async () => {
        mockDeleteRows([{ id: ID }]);
        await expect(deleteServiceSubmission(ID)).resolves.toBe(true);
    });

    it('nieistniejace zgloszenie daje false', async () => {
        mockDeleteRows([]);
        await expect(deleteServiceSubmission(ID)).resolves.toBe(false);
    });
});

describe('setServiceSubmissionStatus', () => {
    it('zapisuje status i zwraca true', async () => {
        const set = mockUpdateRows([{ id: ID }]);
        await expect(setServiceSubmissionStatus(ID, 'added')).resolves.toBe(true);
        expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: 'added' }));
    });

    it('nieistniejace zgloszenie daje false', async () => {
        mockUpdateRows([]);
        await expect(setServiceSubmissionStatus(ID, 'rejected')).resolves.toBe(false);
    });
});

describe('markServiceSubmissionReplySent', () => {
    const SENT_AT = new Date('2026-11-09T09:30:00.000Z');

    it('zapisuje date wysylki bez ruszania updatedAt i ja zwraca', async () => {
        const set = mockUpdateRows([{ replySentAt: SENT_AT }]);

        await expect(markServiceSubmissionReplySent(ID, SENT_AT)).resolves.toEqual(SENT_AT);

        expect(set).toHaveBeenCalledWith({ replySentAt: SENT_AT });
    });

    it('nieistniejace zgloszenie daje null', async () => {
        mockUpdateRows([]);
        await expect(markServiceSubmissionReplySent(ID, SENT_AT)).resolves.toBeNull();
    });
});

describe('deleteExpiredServiceSubmissions', () => {
    const NOW = new Date('2026-11-06T12:00:00.000Z');

    function mockDeleteCapturingWhere(rows: { id: string }[]): jest.Mock<unknown, [SQL]> {
        const where = jest.fn<unknown, [SQL]>(() => ({
            returning: jest.fn().mockResolvedValue(rows),
        }));
        mockDb.delete.mockReturnValue({ where });
        return where;
    }

    it('usuwa tylko rozpatrzone zgloszenia starsze niz 180 dni i podaje ich liczbe', async () => {
        const where = mockDeleteCapturingWhere([{ id: ID }, { id: 'drugi' }]);

        await expect(deleteExpiredServiceSubmissions(NOW)).resolves.toBe(2);

        const { sql, params } = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
        expect(sql).toContain('"status" in');
        expect(sql).toContain('"updated_at" <');
        expect(params).toEqual(['added', 'rejected', '2026-05-10T12:00:00.000Z']);
    });

    it('nic po terminie daje 0', async () => {
        mockDeleteCapturingWhere([]);
        await expect(deleteExpiredServiceSubmissions(NOW)).resolves.toBe(0);
    });
});
