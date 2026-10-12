import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { FlowHeading } from './flow-heading';

expect.extend(toHaveNoViolations);

describe('<FlowHeading />', () => {
    it('przejmuje fokus przy wejsciu na nowy krok', () => {
        render(<FlowHeading shouldFocusOnMount>Sprawdz wpis</FlowHeading>);

        expect(screen.getByRole('heading', { level: 2, name: 'Sprawdz wpis' })).toHaveFocus();
    });

    it('domyslnie nie przejmuje fokusu', () => {
        render(<FlowHeading>Link do firmy</FlowHeading>);

        expect(screen.getByRole('heading', { name: 'Link do firmy' })).not.toHaveFocus();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = render(<FlowHeading shouldFocusOnMount>Krok</FlowHeading>);

        expect(await axe(container)).toHaveNoViolations();
    });
});
