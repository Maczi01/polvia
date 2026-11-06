import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { updateSubmissionStatus } from '../../_actions';
import { SubmissionStatusControl } from './submission-status-control';

expect.extend(toHaveNoViolations);

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';

jest.mock('../../_actions', () => ({ updateSubmissionStatus: jest.fn() }));

const mockUpdate = jest.mocked(updateSubmissionStatus);

beforeEach(() => {
    mockUpdate.mockReset();
});

describe('SubmissionStatusControl', () => {
    it('pokazuje przejscia do pozostalych statusow i nie ma naruszen a11y', async () => {
        const { container } = render(<SubmissionStatusControl id={ID} status="new" />);

        expect(screen.getByRole('button', { name: 'Mark as added' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('klikniecie zapisuje wybrany status', async () => {
        mockUpdate.mockResolvedValue({ data: { status: 'added' } });
        render(<SubmissionStatusControl id={ID} status="new" />);

        await userEvent.click(screen.getByRole('button', { name: 'Mark as added' }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(ID, 'added'));
    });

    it('blad zapisu pokazuje komunikat', async () => {
        mockUpdate.mockResolvedValue({
            error: { code: 'SAVE_FAILED', message: 'Could not save the status. Try again.' },
        });
        render(<SubmissionStatusControl id={ID} status="added" />);

        await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));

        expect(await screen.findByText('Could not save the status. Try again.')).toBeInTheDocument();
    });

    it('odrzucona akcja pokazuje komunikat zamiast wywracac strone', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockUpdate.mockRejectedValue(new TypeError('Failed to fetch'));
        render(<SubmissionStatusControl id={ID} status="new" />);

        await userEvent.click(screen.getByRole('button', { name: 'Reject' }));

        expect(await screen.findByText('Could not reach the server. Try again.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
        consoleError.mockRestore();
    });
});
