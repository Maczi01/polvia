import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import {
    premiumEmptyFixture,
    premiumProfessionalFixture,
    premiumServiceFixture,
} from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { TemplateProfessional } from './template-professional';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

describe('TemplateProfessional', () => {
    it('renderuje nazwe jako h1 i stawia cennik przed opisem firmy; przechodzi jest-axe', async () => {
        const { container } = renderWithIntl(<TemplateProfessional profile={premiumProfessionalFixture} />);

        expect(
            screen.getByRole('heading', { level: 1, name: premiumProfessionalFixture.name }),
        ).toBeInTheDocument();
        const sectionHeadings = screen
            .getAllByRole('heading', { level: 2 })
            .map(heading => heading.textContent);
        expect(sectionHeadings.slice(0, 3)).toEqual(['Cennik usług', 'Najczęstsze pytania', 'O firmie']);
        expect(await axe(container)).toHaveNoViolations();
    });

    it('pokazuje 4 miniatury galerii z licznikiem pozostalych i cover w sekcji "O firmie"', () => {
        renderWithIntl(<TemplateProfessional profile={premiumServiceFixture} />);

        expect(screen.getAllByRole('button', { name: /^Powiększ zdjęcie/ })).toHaveLength(4);
        expect(screen.getByText('+8')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Narzędzia ekipy remontowej' })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Podobne firmy' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /ulepsz stronę/ })).not.toBeInTheDocument();
    });

    it('bez tresci premium i lokalizacji nie renderuje pustych sekcji', async () => {
        const { container } = renderWithIntl(<TemplateProfessional profile={premiumEmptyFixture} />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(premiumEmptyFixture.name);
        expect(screen.queryByRole('region', { name: 'Galeria' })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Cennik usług' })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Najczęstsze pytania' })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });
});
