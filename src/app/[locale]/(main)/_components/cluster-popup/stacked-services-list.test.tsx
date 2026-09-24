import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { PartialService } from '@/types';

import { StackedServicesList } from './stacked-services-list';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna — mock zwraca klucz i liczbe, wiec asercje
// sprawdzaja strukture listy, nie tresc tlumaczen.
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: { count?: number }) =>
        values?.count === undefined ? key : `${key}:${values.count}`,
}));

let counter = 0;

function service(overrides: Partial<PartialService> = {}): PartialService {
    counter += 1;
    return {
        id: `id-${counter}`,
        serviceId: `service-${counter}`,
        slug: `slug-${counter}`,
        name: `Usluga ${counter}`,
        description: null,
        category: 'beauty',
        coverage: 'local',
        tags: null,
        city: 'Warszawa',
        street: null,
        voivodeship: 'mazowieckie',
        postcode: null,
        latitude: 52.2297,
        longitude: 21.0122,
        openingHours: {},
        phoneNumber: null,
        email: null,
        webpage: null,
        image: null,
        languages: ['pl'],
        socials: null,
        whatsappNumber: null,
        verified: false,
        ...overrides,
    };
}

describe('<StackedServicesList />', () => {
    it('pokazuje kazdy wpis spod wspolnego adresu jako osobny przycisk', () => {
        const services = [service({ name: 'G.Bar' }), service({ name: 'KIDP' })];

        render(<StackedServicesList services={services} onSelect={jest.fn()} />);

        expect(screen.getByText('stackedHeader:2')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /G\.Bar/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /KIDP/ })).toBeInTheDocument();
    });

    it('klikniecie wpisu przekazuje dokladnie ten wpis, nie pierwszy z listy', async () => {
        const first = service({ name: 'Pierwsza' });
        const second = service({ name: 'Druga' });
        const handleSelect = jest.fn();

        render(<StackedServicesList services={[first, second]} onSelect={handleSelect} />);
        await userEvent.click(screen.getByRole('button', { name: /Druga/ }));

        expect(handleSelect).toHaveBeenCalledTimes(1);
        expect(handleSelect).toHaveBeenCalledWith(second);
    });

    it('wpis bez miasta nie wyswietla pustej linii adresu', () => {
        render(
            <StackedServicesList services={[service({ name: 'Bez miasta', city: null })]} onSelect={jest.fn()} />,
        );

        expect(screen.getByRole('button', { name: 'Bez miasta' })).toBeInTheDocument();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = render(
            <StackedServicesList services={[service(), service()]} onSelect={jest.fn()} />,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
