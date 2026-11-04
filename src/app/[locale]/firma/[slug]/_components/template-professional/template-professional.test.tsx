import { screen, within } from '@testing-library/react';
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
    it('pokazuje oceny z innych serwisow tylko, gdy tresc premium je ma', () => {
        const { unmount } = renderWithIntl(
            <TemplateProfessional profile={premiumProfessionalFixture} />,
        );

        const ratings = screen.getByRole('region', { name: 'Opinie w innych serwisach' });
        expect(within(ratings).getByRole('link', { name: /^Google: / })).toBeInTheDocument();
        unmount();

        renderWithIntl(<TemplateProfessional profile={premiumEmptyFixture} />);
        expect(
            screen.queryByRole('region', { name: 'Opinie w innych serwisach' }),
        ).not.toBeInTheDocument();
    });

    it('okruszki nad nazwa: kategoria i miasto prowadza do mapy z filtrem', () => {
        renderWithIntl(<TemplateProfessional profile={premiumProfessionalFixture} />);

        const nav = screen.getByRole('navigation', { name: 'Ścieżka nawigacji' });
        expect(within(nav).getByRole('link', { name: 'Prawne' })).toHaveAttribute(
            'href',
            '/mapa/prawne',
        );
        expect(within(nav).getByRole('link', { name: 'Warszawa' })).toHaveAttribute(
            'href',
            '/mapa/prawne/warszawa',
        );
        expect(within(nav).getByText(premiumProfessionalFixture.name)).toHaveAttribute(
            'aria-current',
            'page',
        );
    });

    it('kilka adresow: pod nazwa miasta z liczba lokalizacji, godziny siedziby glownej', () => {
        renderWithIntl(<TemplateProfessional profile={premiumServiceFixture} />);

        const header = screen.getByRole('banner');
        expect(within(header).getByText('Warszawa, Piaseczno · 2 lokalizacje')).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Godziny otwarcia — siedziba główna' }),
        ).toBeInTheDocument();
    });
});
