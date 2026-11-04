/**
 * @jest-environment node
 */
import { DashboardAccessDeniedError } from '@/lib/dashboard-access';

import {
    createService,
    createTag,
    deleteService,
    getServiceById,
    getServicesForDashboard,
    getTags,
    updateService,
} from './_actions';

/**
 * Akcje panelu to publiczne endpointy POST wywolywalne spod dowolnego adresu (middleware
 * ich nie chroni). Bez poprawnego `Authorization` kazda musi odmowic, zanim dotknie bazy.
 */
const PASSWORD = 'p'.repeat(32);
let mockAuthorization: string | null = null;

const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
};

jest.mock('../../../../../env', () => ({
    env: { DASHBOARD_USER: 'admin', DASHBOARD_PASSWORD: 'p'.repeat(32) },
}));
jest.mock('@/db', () => ({
    get db() {
        return mockDb;
    },
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/headers', () => ({
    headers: async () =>
        new Headers(mockAuthorization ? { authorization: mockAuthorization } : {}),
}));

const DENIED = { success: false, message: 'Brak uprawnien' };

function expectDbUntouched(): void {
    for (const method of Object.values(mockDb)) expect(method).not.toHaveBeenCalled();
}

describe.each([
    ['no Authorization header', null],
    ['wrong password', `Basic ${btoa('admin:wrong')}`],
])('dashboard actions with %s', (_label, authorization) => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthorization = authorization;
    });

    it.each([
        ['getServicesForDashboard', () => getServicesForDashboard()],
        ['getTags', () => getTags()],
        ['getServiceById', () => getServiceById('00000000-0000-0000-0000-000000000000')],
    ])('%s throws DashboardAccessDeniedError', async (_name, call) => {
        await expect(call()).rejects.toBeInstanceOf(DashboardAccessDeniedError);
        expectDbUntouched();
    });

    it('createTag is denied', async () => {
        await expect(createTag({ pl: 'tag' })).resolves.toEqual({
            success: false,
            error: DENIED.message,
        });
        expectDbUntouched();
    });

    it.each([
        ['createService', () => createService(DENIED, new FormData())],
        ['updateService', () => updateService(DENIED, new FormData())],
        ['deleteService', () => deleteService('00000000-0000-0000-0000-000000000000')],
    ])('%s is denied', async (_name, call) => {
        await expect(call()).resolves.toEqual(DENIED);
        expectDbUntouched();
    });
});

describe('dashboard actions with correct credentials', () => {
    it('deleteService reaches the database', async () => {
        mockAuthorization = `Basic ${btoa(`admin:${PASSWORD}`)}`;
        const where = jest.fn().mockResolvedValue({ rowCount: 1 });
        mockDb.delete.mockReturnValue({ where });

        await expect(deleteService('00000000-0000-0000-0000-000000000000')).resolves.toEqual({
            success: true,
            message: 'Service deleted successfully',
        });
        expect(where).toHaveBeenCalledTimes(1);
    });
});
