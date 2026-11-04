import 'server-only';

import { headers } from 'next/headers';

import { env } from '../../env';
import { isAuthorizedDashboardRequest, resolveDashboardCredentials } from './dashboard-auth';

/**
 * Serwerowa bramka panelu — druga linia za middleware. Server Action to publiczny endpoint
 * POST wywolywalny pod DOWOLNYM adresem (naglowek `Next-Action`), wiec middleware na
 * `/dashboard/**` jej nie chroni: kazda eksportowana akcja panelu musi sprawdzic dostep sama.
 * Przegladarka po zalogowaniu wysyla `Authorization` takze z POST-em akcji pod `/dashboard`.
 */
export async function hasDashboardAccess(): Promise<boolean> {
    const credentials = resolveDashboardCredentials(env);
    if (!credentials) return false;
    const requestHeaders = await headers();
    return isAuthorizedDashboardRequest(requestHeaders.get('authorization'), credentials);
}

export class DashboardAccessDeniedError extends Error {
    readonly code = 'FORBIDDEN';

    constructor() {
        super('Dashboard access denied');
        this.name = 'DashboardAccessDeniedError';
    }
}

/** Dla odczytow panelu: rzuca zamiast zwracac dane. */
export async function assertDashboardAccess(): Promise<void> {
    if (!(await hasDashboardAccess())) throw new DashboardAccessDeniedError();
}
