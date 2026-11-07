/**
 * @jest-environment node
 */
import { hasDashboardAccess } from '@/lib/dashboard-access';
import {
    getServiceSubmission,
    getServiceSubmissionLogo,
    type ServiceSubmission,
} from '@/lib/service-submissions';

import { GET as getJson } from './json/route';
import { GET as getLogo } from './logo/route';

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';
const LOGO = Buffer.from('png-bytes');
const context = { params: Promise.resolve({ id: ID }) };
const SUBMISSION: ServiceSubmission = {
    id: ID,
    status: 'new',
    name: 'Kancelaria Nowak',
    slug: 'kancelaria-nowak',
    entry: {
        name: 'Kancelaria Nowak',
        category: 'law',
        translations: {
            pl: { description: 'pl' },
            uk: { description: 'uk' },
            en: { description: 'en' },
            ru: { description: 'ru' },
        },
        locations: [{ city: 'Warszawa' }],
    },
    unconfirmed: [],
    changedByOwner: [],
    missingCoordinates: false,
    manualPin: false,
    submitterEmail: 'wlasciciel@nowak.pl',
    notes: null,
    premiumInfoConsent: false,
    locale: 'pl',
    source: 'owner',
    sourceUrl: null,
    createdAt: new Date('2026-11-06T10:00:00Z'),
    hasLogo: false,
};

jest.mock('@/lib/dashboard-access', () => ({ hasDashboardAccess: jest.fn() }));
jest.mock('@/lib/service-submissions', () => ({
    getServiceSubmission: jest.fn(),
    getServiceSubmissionLogo: jest.fn(),
}));

const mockAccess = jest.mocked(hasDashboardAccess);
const mockSubmission = jest.mocked(getServiceSubmission);
const mockLogo = jest.mocked(getServiceSubmissionLogo);

function request(query = ''): Request {
    return new Request(`https://polvia.test/dashboard/submissions/${ID}/logo${query}`);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockResolvedValue(true);
});

describe('GET json', () => {
    it('oddaje plik wpisu jako zalacznik, bez danych zglaszajacego', async () => {
        mockSubmission.mockResolvedValue(SUBMISSION);

        const response = await getJson(request(), context);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="kancelaria-nowak.json"',
        );
        const body = await response.text();
        expect(JSON.parse(body)).toEqual(SUBMISSION.entry);
        expect(body).not.toContain('wlasciciel@nowak.pl');
    });

    it('bez dostepu daje 404 bez czytania bazy', async () => {
        mockAccess.mockResolvedValue(false);

        const response = await getJson(request(), context);

        expect(response.status).toBe(404);
        expect(mockSubmission).not.toHaveBeenCalled();
    });

    it('nieistniejace zgloszenie daje 404', async () => {
        mockSubmission.mockResolvedValue(null);
        expect((await getJson(request(), context)).status).toBe(404);
    });
});

describe('GET logo', () => {
    beforeEach(() => {
        mockLogo.mockResolvedValue({ slug: 'kancelaria-nowak', logo: LOGO });
    });

    it('oddaje PNG do podgladu', async () => {
        const response = await getLogo(request(), context);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('image/png');
        expect(response.headers.get('content-disposition')).toContain('inline');
        expect(Buffer.from(await response.arrayBuffer())).toEqual(LOGO);
    });

    it('z ?download=1 oddaje zalacznik o nazwie sluga', async () => {
        const response = await getLogo(request('?download=1'), context);

        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="kancelaria-nowak.png"',
        );
    });

    it('bez dostepu daje 404 bez czytania bazy', async () => {
        mockAccess.mockResolvedValue(false);

        const response = await getLogo(request(), context);

        expect(response.status).toBe(404);
        expect(mockLogo).not.toHaveBeenCalled();
    });

    it('zgloszenie bez logo daje 404', async () => {
        mockLogo.mockResolvedValue(null);
        expect((await getLogo(request(), context)).status).toBe(404);
    });
});
