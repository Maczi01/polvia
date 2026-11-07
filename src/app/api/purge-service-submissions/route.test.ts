/**
 * @jest-environment node
 */
// Request/Response wymagaja fetch API, ktorego jsdom nie ma.
import { NextRequest } from 'next/server';

import { deleteExpiredServiceSubmissions } from '@/lib/service-submissions';

import { GET } from './route';

const SECRET = 'a'.repeat(32);
const mockEnv: { CRON_SECRET?: string } = { CRON_SECRET: SECRET };

jest.mock('../../../../env', () => ({
    get env() {
        return mockEnv;
    },
}));
jest.mock('@/lib/service-submissions', () => ({ deleteExpiredServiceSubmissions: jest.fn() }));

const mockDelete = jest.mocked(deleteExpiredServiceSubmissions);

function cronRequest(authorization?: string): NextRequest {
    return new NextRequest('https://www.polvia.pl/api/purge-service-submissions', {
        headers: authorization ? { authorization } : {},
    });
}

describe('GET /api/purge-service-submissions', () => {
    beforeEach(() => {
        mockDelete.mockReset();
        mockEnv.CRON_SECRET = SECRET;
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('z poprawnym sekretem usuwa i podaje liczbe wierszy', async () => {
        mockDelete.mockResolvedValue(3);

        const response = await GET(cronRequest(`Bearer ${SECRET}`));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ data: { deleted: 3 } });
    });

    it.each([
        ['bez naglowka', undefined],
        ['ze zlym sekretem', `Bearer ${'b'.repeat(32)}`],
        ['z sekretem bez Bearer', SECRET],
    ])('%s odmawia i niczego nie usuwa', async (_name, authorization) => {
        const response = await GET(cronRequest(authorization));

        expect(response.status).toBe(401);
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('bez skonfigurowanego sekretu niczego nie usuwa, nawet dla "Bearer undefined"', async () => {
        mockEnv.CRON_SECRET = undefined;

        const response = await GET(cronRequest('Bearer undefined'));

        expect(response.status).toBe(503);
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('blad bazy daje 500 bez tresci bledu w odpowiedzi i logu', async () => {
        mockDelete.mockRejectedValue(new Error('params: wlasciciel@nowak.pl'));

        const response = await GET(cronRequest(`Bearer ${SECRET}`));

        expect(response.status).toBe(500);
        await expect(response.text()).resolves.not.toContain('nowak.pl');
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain('nowak.pl');
    });
});
