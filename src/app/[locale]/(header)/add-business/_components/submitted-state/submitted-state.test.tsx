import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { PIN_FIXTURE, PREVIEW_FIXTURE } from '../business-card-preview/preview-fixture';
import { renderWithIntl } from '../test-utils/render-with-intl';
import { SubmittedState } from './submitted-state';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'));

function renderSubmitted() {
    return renderWithIntl(
        <SubmittedState card={PREVIEW_FIXTURE} unconfirmed={[]} pin={PIN_FIXTURE} logoSrc={null} />,
    );
}

describe('<SubmittedState />', () => {
    it('dziekuje z nazwa firmy i informuje o mailu potwierdzajacym', () => {
        renderSubmitted();

        expect(screen.getByRole('heading', { name: 'Dziękujemy za zgłoszenie!' })).toHaveFocus();
        expect(
            screen.getByText(/Zgłoszenie firmy Kawiarnia Lwów trafiło do nas/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Na Twój adres e-mail wysłaliśmy potwierdzenie z kopią zgłoszonych danych.',
            ),
        ).toBeInTheDocument();
    });

    it('pokazuje karte tylko do odczytu — bez pol formularza', () => {
        renderSubmitted();

        expect(
            screen.getByRole('heading', { level: 3, name: 'Kawiarnia Lwów' }),
        ).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Wróć na stronę główną' })).toHaveAttribute(
            'href',
            '/',
        );
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderSubmitted();

        expect(await axe(container)).toHaveNoViolations();
    });
});
