/**
 * @jest-environment node
 */
import { hasDashboardAccess } from '@/lib/dashboard-access';
import { sendMail } from '@/lib/mailer';
import { isSubmissionPublishingEnabled, publishServiceSubmission } from '@/lib/publish-submission';
import {
    deleteServiceSubmission,
    getServiceSubmission,
    markServiceSubmissionReplySent,
    type ServiceSubmission,
    setServiceSubmissionStatus,
} from '@/lib/service-submissions';

import {
    deleteSubmission,
    publishSubmission,
    sendSubmissionReply,
    updateSubmissionStatus,
} from './_actions';

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/dashboard-access', () => ({ hasDashboardAccess: jest.fn() }));
jest.mock('@/lib/mailer', () => ({ sendMail: jest.fn() }));
jest.mock('@/lib/publish-submission', () => ({
    isSubmissionPublishingEnabled: jest.fn(),
    publishServiceSubmission: jest.fn(),
}));
jest.mock('@/lib/service-submissions', () => ({
    deleteServiceSubmission: jest.fn(),
    getServiceSubmission: jest.fn(),
    markServiceSubmissionReplySent: jest.fn(),
    setServiceSubmissionStatus: jest.fn(),
}));

const mockAccess = jest.mocked(hasDashboardAccess);
const mockSetStatus = jest.mocked(setServiceSubmissionStatus);
const mockDelete = jest.mocked(deleteServiceSubmission);
const mockPublishingEnabled = jest.mocked(isSubmissionPublishingEnabled);
const mockPublish = jest.mocked(publishServiceSubmission);

beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockResolvedValue(true);
    mockSetStatus.mockResolvedValue(true);
    mockDelete.mockResolvedValue(true);
    mockPublishingEnabled.mockReturnValue(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('publishSubmission', () => {
    const PUBLISHED = {
        serviceSlug: 'kancelaria-nowak',
        files: ['data/services/kancelaria-nowak.json'],
        isSearchIndexed: true,
    };

    it('publikuje i zwraca wynik', async () => {
        mockPublish.mockResolvedValue({ ok: true, data: PUBLISHED });

        await expect(publishSubmission(ID)).resolves.toEqual({ data: PUBLISHED });
        expect(mockPublish).toHaveBeenCalledWith(ID);
    });

    it('bez dostepu odmawia przed publikacja', async () => {
        mockAccess.mockResolvedValue(false);

        const result = await publishSubmission(ID);

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(mockPublish).not.toHaveBeenCalled();
    });

    it('poza next dev odmawia mimo dostepu', async () => {
        mockPublishingEnabled.mockReturnValue(false);

        const result = await publishSubmission(ID);

        expect(result.error?.code).toBe('LOCAL_ONLY');
        expect(mockPublish).not.toHaveBeenCalled();
    });

    it('id spoza UUID daje BAD_INPUT', async () => {
        const result = await publishSubmission('nie-uuid');

        expect(result.error?.code).toBe('BAD_INPUT');
        expect(mockPublish).not.toHaveBeenCalled();
    });

    it('przekazuje kod i powod odmowy', async () => {
        mockPublish.mockResolvedValue({ ok: false, code: 'DUPLICATE_NAME', message: 'Duplikat' });

        await expect(publishSubmission(ID)).resolves.toEqual({
            error: { code: 'DUPLICATE_NAME', message: 'Duplikat' },
        });
    });

    it('nieoczekiwany blad daje SAVE_FAILED bez surowego komunikatu', async () => {
        mockPublish.mockRejectedValue(new Error('connection refused 10.0.0.1'));

        const result = await publishSubmission(ID);

        expect(result.error?.code).toBe('SAVE_FAILED');
        expect(result.error?.message).not.toContain('10.0.0.1');
    });
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

describe('sendSubmissionReply', () => {
    const SUBJECT = 'Firma jest w katalogu';
    const TEXT = 'Wpis: https://www.polvia.pl/firma/nowak';
    const OWNER = 'wlasciciel@nowak.pl';
    const mockGet = jest.mocked(getServiceSubmission);
    const mockSend = jest.mocked(sendMail);

    const SENT_AT = new Date('2026-11-09T09:30:00.000Z');
    const EARLIER = new Date('2026-11-08T12:00:00.000Z');
    const mockMarkSent = jest.mocked(markServiceSubmissionReplySent);

    function submission(
        status: ServiceSubmission['status'],
        replySentAt: Date | null = null,
    ): ServiceSubmission {
        return { id: ID, status, submitterEmail: OWNER, replySentAt } as ServiceSubmission;
    }

    beforeEach(() => {
        mockGet.mockResolvedValue(submission('added'));
        mockSend.mockResolvedValue({ ok: true });
        mockMarkSent.mockResolvedValue(SENT_AT);
    });

    it('wysyla edytowana tresc na adres zglaszajacego z bazy i zapisuje date', async () => {
        const result = await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(result).toEqual({ data: { id: ID, sentAt: SENT_AT.toISOString() } });
        expect(mockSend).toHaveBeenCalledWith({ to: OWNER, subject: SUBJECT, text: TEXT });
        expect(mockMarkSent).toHaveBeenCalledWith(ID, expect.any(Date));
    });

    it('juz wyslana odpowiedz bez potwierdzenia ponownej wysylki daje ALREADY_SENT', async () => {
        mockGet.mockResolvedValue(submission('added', EARLIER));

        const result = await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(result.error?.code).toBe('ALREADY_SENT');
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockMarkSent).not.toHaveBeenCalled();
    });

    it('potwierdzona ponowna wysylka idzie i nadpisuje date', async () => {
        mockGet.mockResolvedValue(submission('added', EARLIER));

        const result = await sendSubmissionReply(ID, SUBJECT, TEXT, true);

        expect(result.data?.sentAt).toBe(SENT_AT.toISOString());
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('wyslany mail bez zapisanej daty to nadal sukces, nie SEND_FAILED', async () => {
        mockMarkSent.mockRejectedValue(new Error(`params: ${OWNER}`));

        const result = await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(result).toEqual({ data: { id: ID, sentAt: null } });
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(OWNER);
    });

    it('nieudana wysylka nie zapisuje daty', async () => {
        mockSend.mockResolvedValue({ ok: false, code: 'SEND_FAILED' });

        await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(mockMarkSent).not.toHaveBeenCalled();
    });

    it('bez dostepu odmawia, zanim czegokolwiek dotknie', async () => {
        mockAccess.mockResolvedValue(false);

        const result = await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(mockGet).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it.each([
        ['zle id', 'nie-uuid', SUBJECT, TEXT],
        ['pusty temat', ID, '   ', TEXT],
        ['pusta tresc', ID, SUBJECT, '   '],
        ['nieuzupelniony link', ID, SUBJECT, 'Wpis: [LINK]'],
        ['za dlugi temat', ID, 'a'.repeat(201), TEXT],
    ])('%s daje BAD_INPUT bez wysylki', async (_name, id, subject, text) => {
        const result = await sendSubmissionReply(id, subject, text);

        expect(result.error?.code).toBe('BAD_INPUT');
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('nieistniejace zgloszenie daje NOT_FOUND', async () => {
        mockGet.mockResolvedValue(null);

        const result = await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it.each(['new', 'rejected'] as const)('status %s nie pozwala wyslac', async status => {
        mockGet.mockResolvedValue(submission(status));

        const result = await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(result.error?.code).toBe('NOT_PUBLISHED');
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('nieudana wysylka daje SEND_FAILED', async () => {
        mockSend.mockResolvedValue({ ok: false, code: 'SEND_FAILED' });

        const result = await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(result.error?.code).toBe('SEND_FAILED');
    });

    it('blad bazy daje SEND_FAILED bez adresu w logu', async () => {
        mockGet.mockRejectedValue(new Error(`params: ${OWNER}`));

        const result = await sendSubmissionReply(ID, SUBJECT, TEXT);

        expect(result.error?.code).toBe('SEND_FAILED');
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(OWNER);
    });
});
