import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { HeroPin } from './hero-map-data';
import { HeroMapTooltip } from './hero-map-tooltip';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna. Mock zwraca klucz z parametrami, wiec
// asercje sprawdzaja, KTORY komunikat i z jakimi liczbami trafil do tooltipa.
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: Record<string, number>) =>
        values ? `${key}:${JSON.stringify(values)}` : key,
}));

// Link z @/i18n/navigation ciagnie routing next-intl (ESM w tescie).
jest.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

function pin(overrides: Partial<HeroPin> = {}): HeroPin {
    return {
        svgLabel: 'Law',
        categoryKey: 'law',
        icon: '/icons/law.svg',
        variant: 'gold',
        position: { x: 0, y: 0 },
        voivodeship: 'Pomorskie',
        voivodeshipKey: 'pomorskie',
        placesCount: 7,
        categoriesCount: 3,
        ...overrides,
    };
}

function renderTooltip(heroPin: HeroPin) {
    return render(
        <HeroMapTooltip pin={heroPin} style={{}} visible onMouseEnter={jest.fn()} onMouseLeave={jest.fn()} />,
    );
}

describe('<HeroMapTooltip />', () => {
    it('pokazuje liczbe firm i kategorii z bazy', () => {
        renderTooltip(pin());

        expect(screen.getByText('autoTooltip:{"count":7,"categories":3}')).toBeInTheDocument();
        expect(screen.queryByText('emptyTooltip')).toBeNull();
    });

    it('dla wojewodztwa bez firm pokazuje komunikat o braku, nie "0 firm w 0 kategoriach"', () => {
        renderTooltip(pin({ placesCount: 0, categoriesCount: 0 }));

        expect(screen.getByText('emptyTooltip')).toBeInTheDocument();
        expect(screen.queryByText(/autoTooltip/)).toBeNull();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderTooltip(pin());

        expect(await axe(container)).toHaveNoViolations();
    });
});
