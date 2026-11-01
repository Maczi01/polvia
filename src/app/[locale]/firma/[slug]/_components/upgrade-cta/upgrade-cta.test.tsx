import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { CheckoutState } from '@/lib/premium-checkout-fields';

import { renderWithIntl } from '../profile-test-utils';
import { UpgradeCta } from './upgrade-cta';

expect.extend(toHaveNoViolations);

const SERVICE_ID = '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01';
const CTA = 'To moja firma — ulepsz stronę';

function renderCta(action: jest.Mock<Promise<CheckoutState>, [CheckoutState, FormData]>) {
    return renderWithIntl(<UpgradeCta serviceId={SERVICE_ID} action={action} />);
}

describe('UpgradeCta', () => {
    it('pokazuje oba interwaly z cenami, domyslnie miesieczny, i przechodzi jest-axe', async () => {
        const action = jest.fn<Promise<CheckoutState>, [CheckoutState, FormData]>();
        const { container } = renderCta(action);

        expect(screen.getByRole('group', { name: 'Okres rozliczenia' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Miesięcznie.*9 zł/ })).toBeChecked();
        expect(screen.getByRole('radio', { name: /Rocznie.*49 zł/ })).not.toBeChecked();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('wysyla serviceId i wybrany interwal, bez ceny z klienta', async () => {
        const action = jest.fn<Promise<CheckoutState>, [CheckoutState, FormData]>(async () => null);
        renderCta(action);

        await userEvent.click(screen.getByRole('radio', { name: /Rocznie/ }));
        await userEvent.click(screen.getByRole('button', { name: CTA }));

        expect(action).toHaveBeenCalledTimes(1);
        const formData = action.mock.calls[0][1];
        expect([...formData.keys()].sort()).toEqual(['interval', 'serviceId']);
        expect(formData.get('serviceId')).toBe(SERVICE_ID);
        expect(formData.get('interval')).toBe('yearly');
        expect(await screen.findByRole('button', { name: CTA })).toBeEnabled();
    });

    it('w trakcie blokuje przycisk, a blad akcji podpina do wyboru przez aria-describedby', async () => {
        // React 19 splata trwajace akcje: obietnica musi sie zakonczyc przed koncem testu.
        let finish: (state: CheckoutState) => void = () => {};
        const action = jest.fn<Promise<CheckoutState>, [CheckoutState, FormData]>(
            () => new Promise(resolve => (finish = resolve)),
        );
        const { container } = renderCta(action);

        await userEvent.click(screen.getByRole('radio', { name: /Rocznie/ }));
        await userEvent.click(screen.getByRole('button', { name: CTA }));
        expect(
            await screen.findByRole('button', { name: 'Przekierowuję do płatności…' }),
        ).toBeDisabled();

        finish({ error: { code: 'BAD_INPUT', message: 'Wybierz okres rozliczenia.' } });

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Wybierz okres rozliczenia.');
        expect(
            screen.getByRole('group', { name: 'Okres rozliczenia' }),
        ).toHaveAccessibleDescription('Wybierz okres rozliczenia.');
        expect(screen.getByRole('radio', { name: /Rocznie/ })).toBeChecked();
        expect(await axe(container)).toHaveNoViolations();
    });
});
