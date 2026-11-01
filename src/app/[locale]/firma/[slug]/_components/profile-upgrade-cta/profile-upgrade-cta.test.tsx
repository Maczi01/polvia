import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileUpgradeCta } from './profile-upgrade-cta';

expect.extend(toHaveNoViolations);

const SERVICE_ID = '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01';
const checkoutAction = jest.fn(async () => null);

describe('ProfileUpgradeCta', () => {
    it('ma przycisk "To moja firma — ulepsz stronę" w formularzu checkoutu wpisu', async () => {
        const { container } = renderWithIntl(
            <ProfileUpgradeCta serviceId={SERVICE_ID} checkoutAction={checkoutAction} />,
        );

        const cta = screen.getByRole('button', { name: 'To moja firma — ulepsz stronę' });
        expect(cta.closest('form')).toHaveFormValues({ serviceId: SERVICE_ID });
        expect(await axe(container)).toHaveNoViolations();
    });

    it('wymienia korzysci premium z limitem galerii', () => {
        renderWithIntl(
            <ProfileUpgradeCta serviceId={SERVICE_ID} checkoutAction={checkoutAction} />,
        );

        const section = screen.getByRole('region', { name: 'To Twoja firma?' });
        expect(within(section).getAllByRole('listitem')).toHaveLength(3);
        expect(within(section).getByText(/galeria do 15 zdjęć/)).toBeInTheDocument();
    });
});
