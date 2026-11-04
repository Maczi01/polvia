import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { premiumEmptyFixture, premiumServiceFixture } from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { TemplateGallery } from './template-gallery';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

describe('TemplateGallery', () => {
    it('renderuje nazwe jako h1, cover, galerie, cennik i FAQ; przechodzi jest-axe', async () => {
        const { container } = renderWithIntl(<TemplateGallery profile={premiumServiceFixture} />);

        expect(screen.getByRole('heading', { level: 1, name: 'Mistrz Remontu' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Narzędzia ekipy remontowej' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /^Powiększ zdjęcie/ })).toHaveLength(12);
        expect(screen.getByRole('region', { name: 'Cennik usług' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Najczęstsze pytania' })).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('nie ma "Podobnych firm" ani CTA ulepszenia (R10)', () => {
        renderWithIntl(<TemplateGallery profile={premiumServiceFixture} />);

        expect(screen.queryByRole('region', { name: 'Podobne firmy' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /ulepsz stronę/ })).not.toBeInTheDocument();
    });

    it('bez cover, galerii, cennika, FAQ i lokalizacji nie renderuje pustych sekcji', async () => {
        const { container } = renderWithIntl(<TemplateGallery profile={premiumEmptyFixture} />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(premiumEmptyFixture.name);
        expect(screen.queryByRole('region', { name: 'Galeria' })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Cennik usług' })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Najczęstsze pytania' })).not.toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Godziny otwarcia' })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });
    it('pokazuje oceny z innych serwisow tylko, gdy tresc premium je ma', () => {
        const { unmount } = renderWithIntl(<TemplateGallery profile={premiumServiceFixture} />);

        const ratings = screen.getByRole('region', { name: 'Opinie w innych serwisach' });
        expect(within(ratings).getByRole('link', { name: /^Google: / })).toBeInTheDocument();
        unmount();

        renderWithIntl(<TemplateGallery profile={premiumEmptyFixture} />);
        expect(
            screen.queryByRole('region', { name: 'Opinie w innych serwisach' }),
        ).not.toBeInTheDocument();
    });

    it('okruszki nad nazwa: strona glowna, kategoria, miasto i biezaca firma', () => {
        renderWithIntl(<TemplateGallery profile={premiumServiceFixture} />);

        const nav = screen.getByRole('navigation', { name: 'Ścieżka nawigacji' });
        expect(within(nav).getByRole('link', { name: 'Remonty' })).toHaveAttribute(
            'href',
            '/mapa/remonty',
        );
        expect(within(nav).getByRole('link', { name: 'Warszawa' })).toHaveAttribute(
            'href',
            '/mapa/remonty/warszawa',
        );
        expect(within(nav).getByText('Mistrz Remontu')).toHaveAttribute('aria-current', 'page');
    });

    it('kilka adresow: pod nazwa miasta z liczba lokalizacji, godziny siedziby glownej', () => {
        renderWithIntl(<TemplateGallery profile={premiumServiceFixture} />);

        const header = screen.getByRole('banner');
        expect(within(header).getByText('Warszawa, Piaseczno · 2 lokalizacje')).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Godziny otwarcia — siedziba główna' }),
        ).toBeInTheDocument();
    });
});
