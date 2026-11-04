/**
 * @jest-environment node
 */
import { assertDashboardAccess, DashboardAccessDeniedError, hasDashboardAccess } from './dashboard-access';

const PASSWORD = 'p'.repeat(32);
const mockEnv: { DASHBOARD_USER?: string; DASHBOARD_PASSWORD?: string } = {};
let mockAuthorization: string | null = null;

jest.mock('../../env', () => ({
    get env() {
        return mockEnv;
    },
}));
jest.mock('next/headers', () => ({
    headers: async () =>
        new Headers(mockAuthorization ? { authorization: mockAuthorization } : {}),
}));

beforeEach(() => {
    mockEnv.DASHBOARD_USER = 'admin';
    mockEnv.DASHBOARD_PASSWORD = PASSWORD;
    mockAuthorization = `Basic ${btoa(`admin:${PASSWORD}`)}`;
});

describe('hasDashboardAccess', () => {
    it('grants access for correct Basic credentials', async () => {
        await expect(hasDashboardAccess()).resolves.toBe(true);
    });

    it('denies access for wrong credentials', async () => {
        mockAuthorization = `Basic ${btoa('admin:wrong')}`;
        await expect(hasDashboardAccess()).resolves.toBe(false);
    });

    it('denies access when the dashboard is not configured', async () => {
        delete mockEnv.DASHBOARD_PASSWORD;
        await expect(hasDashboardAccess()).resolves.toBe(false);
    });
});

describe('assertDashboardAccess', () => {
    it('resolves for authorized request', async () => {
        await expect(assertDashboardAccess()).resolves.toBeUndefined();
    });

    it('throws DashboardAccessDeniedError without Authorization header', async () => {
        mockAuthorization = null;
        await expect(assertDashboardAccess()).rejects.toBeInstanceOf(DashboardAccessDeniedError);
    });
});
