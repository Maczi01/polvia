import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../test-utils/render-with-intl';
import { ActionErrorNotice, DuplicateNotice, LimitedNotice } from './flow-notices';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'));

describe('<ActionErrorNotice />', () => {
    it('tlumaczy kod bledu i oglasza go jako alert', () => {
        renderWithIntl(<ActionErrorNotice code="DRAFT_EXPIRED" />);

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Propozycja wpisu wygasła albo została już wysłana. Zacznij od nowa.',
        );
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('przy bledzie wysylki prowadzi do formularza kontaktowego', () => {
        renderWithIntl(<ActionErrorNotice code="SEND_FAILED" />);

        expect(screen.getByRole('link', { name: 'Napisz do nas' })).toHaveAttribute(
            'href',
            '/contact',
        );
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderWithIntl(<ActionErrorNotice code="INTERNAL" />);
        expect(await axe(container)).toHaveNoViolations();
    });
});

describe('<DuplicateNotice />', () => {
    it('linkuje do istniejacego wpisu na mapie i pozwala zaczac od nowa', async () => {
        const onStartOver = jest.fn();
        renderWithIntl(
            <DuplicateNotice
                name="Kawiarnia Lwów"
                slug="kawiarnia-lwow"
                onStartOver={onStartOver}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Ta firma jest już w katalogu' })).toHaveFocus();
        expect(
            screen.getByRole('link', { name: 'Zobacz wpis firmy Kawiarnia Lwów' }),
        ).toHaveAttribute('href', '/map?place=kawiarnia-lwow');

        await userEvent.click(screen.getByRole('button', { name: 'Dodaj inną firmę' }));
        expect(onStartOver).toHaveBeenCalledTimes(1);
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderWithIntl(
            <DuplicateNotice name="Kawiarnia" slug="kawiarnia" onStartOver={jest.fn()} />,
        );
        expect(await axe(container)).toHaveNoViolations();
    });
});

describe('<LimitedNotice />', () => {
    it('podaje czytelny czas ponowienia i link do kontaktu', () => {
        renderWithIntl(<LimitedNotice retryAfter={2 * 60 * 60} />);

        expect(screen.getByText(/Spróbuj ponownie za 2 godziny\./)).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Napisz do nas przez formularz kontaktowy' }),
        ).toHaveAttribute('href', '/contact');
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderWithIntl(<LimitedNotice retryAfter={600} />);
        expect(await axe(container)).toHaveNoViolations();
    });
});
