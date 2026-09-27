import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { TrustSection } from './trust-section';
import type { FeaturedService } from '@/lib/featured-services';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna. Mock zwraca sam klucz, wiec asercje
// sprawdzaja strukture sekcji, nie tresc tlumaczen.
jest.mock('next-intl/server', () => ({
    getTranslations: async () => (key: string) => key,
}));

// Link z @/i18n/navigation ciagnie routing next-intl (ESM w tescie).
jest.mock('@/i18n/navigation', () => ({
    Link: ({
        href,
        children,
        prefetch: _prefetch,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        prefetch?: boolean;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

const FEATURED: FeaturedService[] = [
    { serviceId: 'a', name: 'Kancelaria Nowak', category: 'law', city: 'Kraków', reason: 'popular' },
    { serviceId: 'b', name: 'Online Tłumacz', category: 'others', city: null, reason: 'new' },
];

async function renderSection(featured: FeaturedService[] = FEATURED) {
    return render(await TrustSection({ companiesCount: 137, featured }));
}

describe('<TrustSection />', () => {
    it('pokazuje zaokraglona liczbe firm i wyroznione firmy z danych', async () => {
        await renderSection();

        expect(screen.getByText('130+')).toBeInTheDocument();
        expect(screen.getByText('Kancelaria Nowak')).toBeInTheDocument();
        expect(screen.getByText('Law')).toBeInTheDocument();
        expect(screen.getByText('popularMeta')).toBeInTheDocument();
        expect(screen.getByText('newMeta')).toBeInTheDocument();
    });

    it('nie renderuje miasta dla firmy bez lokalizacji', async () => {
        await renderSection();

        const withCity = screen.getByText('Kancelaria Nowak').closest('.rounded-2xl');
        const withoutCity = screen.getByText('Online Tłumacz').closest('.rounded-2xl');

        expect(withCity).toHaveTextContent('Kraków');
        // tylko nazwa, kategoria i etykieta — zadnej pustej "pigulki" miasta
        expect(withoutCity?.querySelectorAll('.rounded-full')).toHaveLength(0);
        expect(withoutCity).toHaveTextContent(/^Online TłumaczOthersnewMeta$/);
    });

    it('CTA to jeden link do mapy, bez przycisku zagniezdzonego w linku', async () => {
        await renderSection();

        const cta = screen.getByRole('link', { name: 'viewAll' });

        expect(cta).toHaveAttribute('href', '/map');
        expect(cta.querySelector('button')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = await renderSection();

        expect(await axe(container)).toHaveNoViolations();
    });
});
