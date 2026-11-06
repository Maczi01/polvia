/**
 * @jest-environment node
 */
import { hasDashboardAccess } from '@/lib/dashboard-access';
import { deleteServiceSubmission, setServiceSubmissionStatus } from '@/lib/service-submissions';

import { deleteSubmission, updateSubmissionStatus } from './_actions';

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/dashboard-access', () => ({ hasDashboardAccess: jest.fn() }));
jest.mock('@/lib/service-submissions', () => ({
    deleteServiceSubmission: jest.fn(),
    setServiceSubmissionStatus: jest.fn(),
}));

const mockAccess = jest.mocked(hasDashboardAccess);
const mockSetStatus = jest.mocked(setServiceSubmissionStatus);
const mockDelete = jest.mocked(deleteServiceSubmission);

beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockResolvedValue(true);
    mockSetStatus.mockResolvedValue(true);
    mockDelete.mockResolvedValue(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('deleteSubmission', () => {
    it('usuwa zgloszenie', async () => {
        await expect(deleteSubmission(ID)).resolves.toEqual({ data: { id: ID } });
        expect(mockDelete).toHaveBeenCalledWith(ID);
    });

    it('bez dostepu odmawia przed walidacja i usunieciem', async () => {
        mockAccess.mockResolvedValue(false);

        const result = await deleteSubmission('nie-uuid');

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('id spoza UUID daje BAD_INPUT', async () => {
        const result = await deleteSubmission('nie-uuid');

        expect(result.error?.code).toBe('BAD_INPUT');
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('nieistniejace zgloszenie daje NOT_FOUND', async () => {
        mockDelete.mockResolvedValue(false);
        const result = await deleteSubmission(ID);
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('blad bazy daje SAVE_FAILED bez surowego komunikatu', async () => {
        mockDelete.mockRejectedValue(new Error('connection refused 10.0.0.1'));

        const result = await deleteSubmission(ID);

        expect(result.error?.code).toBe('SAVE_FAILED');
        expect(result.error?.message).not.toContain('10.0.0.1');
    });
});

describe('updateSubmissionStatus', () => {
    it('zapisuje poprawny status', async () => {
        await expect(updateSubmissionStatus(ID, 'added')).resolves.toEqual({
            data: { status: 'added' },
        });
        expect(mockSetStatus).toHaveBeenCalledWith(ID, 'added');
    });

    it('bez dostepu odmawia przed walidacja i zapisem', async () => {
        mockAccess.mockResolvedValue(false);

        const result = await updateSubmissionStatus('nie-uuid', 'hacked');

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(mockSetStatus).not.toHaveBeenCalled();
    });

    it.each([
        ['id spoza UUID', 'nie-uuid', 'added'],
        ['nieznany status', ID, 'published'],
    ])('odrzuca %s', async (_label, id, status) => {
        const result = await updateSubmissionStatus(id, status);

        expect(result.error?.code).toBe('BAD_INPUT');
        expect(mockSetStatus).not.toHaveBeenCalled();
    });

    it('nieistniejace zgloszenie daje NOT_FOUND', async () => {
        mockSetStatus.mockResolvedValue(false);
        const result = await updateSubmissionStatus(ID, 'rejected');
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('blad bazy daje SAVE_FAILED bez surowego komunikatu', async () => {
        mockSetStatus.mockRejectedValue(new Error('connection refused 10.0.0.1'));

        const result = await updateSubmissionStatus(ID, 'added');

        expect(result.error?.code).toBe('SAVE_FAILED');
        expect(result.error?.message).not.toContain('10.0.0.1');
    });
});
