import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { deleteSubmission } from '../../_actions';
import { SubmissionDeleteButton } from './submission-delete-button';

expect.extend(toHaveNoViolations);

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';
const mockReplace = jest.fn();

jest.mock('../../_actions', () => ({ deleteSubmission: jest.fn() }));
jest.mock('@/i18n/navigation', () => ({
    useRouter: () => ({ replace: mockReplace }),
}));

const mockDelete = jest.mocked(deleteSubmission);

beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockReset();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
    jest.restoreAllMocks();
});

async function clickDelete(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
}

describe('SubmissionDeleteButton', () => {
    it('po potwierdzeniu usuwa i wraca na liste, bez naruszen a11y', async () => {
        mockDelete.mockResolvedValue({ data: { id: ID } });
        const { container } = render(<SubmissionDeleteButton id={ID} name="Kancelaria" />);

        expect(await axe(container)).toHaveNoViolations();
        await clickDelete();

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/dashboard/submissions'));
        expect(mockDelete).toHaveBeenCalledWith(ID);
    });

    it('anulowanie potwierdzenia niczego nie usuwa', async () => {
        jest.mocked(window.confirm).mockReturnValue(false);
        render(<SubmissionDeleteButton id={ID} name="Kancelaria" />);

        await clickDelete();

        expect(mockDelete).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('blad akcji pokazuje komunikat i zostaje na stronie', async () => {
        mockDelete.mockResolvedValue({
            error: { code: 'SAVE_FAILED', message: 'Could not delete the submission. Try again.' },
        });
        render(<SubmissionDeleteButton id={ID} name="Kancelaria" />);

        await clickDelete();

        expect(
            await screen.findByText('Could not delete the submission. Try again.'),
        ).toBeInTheDocument();
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('odrzucona akcja pokazuje komunikat zamiast wywracac strone', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockDelete.mockRejectedValue(new TypeError('Failed to fetch'));
        render(<SubmissionDeleteButton id={ID} name="Kancelaria" />);

        await clickDelete();

        expect(await screen.findByText('Could not reach the server. Try again.')).toBeInTheDocument();
    });
});
