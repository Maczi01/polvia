import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { premiumEmptyFixture, premiumOf, premiumServiceFixture } from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { TemplateClassic } from './template-classic';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

describe('TemplateClassic', () => {
    it('renderuje nazwe jako h1, cover i 6 miniatur galerii; przechodzi jest-axe', async () => {
        const { container } = renderWithIntl(
            <TemplateClassic
                profile={premiumServiceFixture}
                premium={premiumOf(premiumServiceFixture)}
            />,
        );

        expect(screen.getByRole('heading', { level: 1, name: 'Mistrz Remontu' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Narzędzia ekipy remontowej' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /^Powiększ zdjęcie/ })).toHaveLength(6);
        expect(screen.getByRole('region', { name: 'Cennik usług' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Najczęstsze pytania' })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Podobne firmy' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /ulepsz stronę/ })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('bez cover, galerii i lokalizacji nie renderuje pustych sekcji', async () => {
        const { container } = renderWithIntl(
            <TemplateClassic profile={premiumEmptyFixture} premium={premiumOf(premiumEmptyFixture)} />,
        );

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(premiumEmptyFixture.name);
        expect(screen.queryByRole('region', { name: 'Galeria' })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Cennik usług' })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: /Adres|Lokalizacje/ })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });
});
