/**
 * @jest-environment node
 */
import {
    isAuthorizedDashboardRequest,
    isDashboardPathname,
    resolveDashboardCredentials,
} from './dashboard-auth';

const CREDENTIALS = { user: 'admin', password: 'a'.repeat(32) };

function basic(value: string): string {
    return `Basic ${btoa(value)}`;
}

describe('resolveDashboardCredentials', () => {
    it('returns credentials when both variables are set', () => {
        expect(
            resolveDashboardCredentials({ DASHBOARD_USER: 'admin', DASHBOARD_PASSWORD: 'secret' }),
        ).toEqual({ user: 'admin', password: 'secret' });
    });

    it.each([
        {},
        { DASHBOARD_USER: 'admin' },
        { DASHBOARD_PASSWORD: 'secret' },
        { DASHBOARD_USER: '', DASHBOARD_PASSWORD: 'secret' },
    ])('disables the dashboard (null) for incomplete config %p', env => {
        expect(resolveDashboardCredentials(env)).toBeNull();
    });
});

describe('isDashboardPathname', () => {
    it.each([
        '/dashboard',
        '/dashboard/',
        '/dashboard/services/new',
        '/en/dashboard',
        '/uk/dashboard/services/123/edit',
        '/Dashboard',
        '/dash%62oard/services',
        '/%E0%A4%A',
    ])('treats %s as dashboard', pathname => {
        expect(isDashboardPathname(pathname)).toBe(true);
    });

    it.each(['/', '/mapa', '/firma/dashboard', '/dashboards', '/en', '/de/dashboard'])(
        'does not treat %s as dashboard',
        pathname => {
            expect(isDashboardPathname(pathname)).toBe(false);
        },
    );
});

describe('isAuthorizedDashboardRequest', () => {
    it('accepts correct credentials', () => {
        expect(
            isAuthorizedDashboardRequest(basic(`admin:${'a'.repeat(32)}`), CREDENTIALS),
        ).toBe(true);
    });

    it('accepts a password containing a colon', () => {
        const credentials = { user: 'admin', password: 'pa:ss' };
        expect(isAuthorizedDashboardRequest(basic('admin:pa:ss'), credentials)).toBe(true);
    });

    it.each([
        ['missing header', null],
        ['wrong password', basic('admin:wrong')],
        ['password prefix', basic(`admin:${'a'.repeat(31)}`)],
        ['password with extra suffix', basic(`admin:${'a'.repeat(33)}`)],
        ['wrong user', basic(`root:${'a'.repeat(32)}`)],
        ['no separator', basic('admin')],
        ['other scheme', `Bearer ${btoa(`admin:${'a'.repeat(32)}`)}`],
        ['invalid base64', 'Basic !!!notbase64'],
        ['empty token', 'Basic '],
    ])('rejects %s', (_label, header) => {
        expect(isAuthorizedDashboardRequest(header, CREDENTIALS)).toBe(false);
    });
});
