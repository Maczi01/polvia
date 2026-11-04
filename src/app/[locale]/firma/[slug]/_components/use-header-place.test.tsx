import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import type { Locale } from '@/i18n/config';

import en from '../../../../../../messages/en.json';
import pl from '../../../../../../messages/pl.json';
import ru from '../../../../../../messages/ru.json';
import uk from '../../../../../../messages/uk.json';
import {
    chainServiceFixture,
    localServiceFixture,
    makeLocation,
    onlineServiceFixture,
} from './profile-fixtures';
import type { ServiceProfileView } from './service-profile-types';
import { useHeaderPlace } from './use-header-place';

const MESSAGES: Record<Locale, typeof pl> = { pl, en, ru, uk };

type Profile = Pick<ServiceProfileView, 'coverage' | 'locations'>;

function headerPlace(profile: Profile, locale: Locale = 'pl'): string | null {
    function Wrapper({ children }: { children: ReactNode }): ReactElement {
        return (
            <NextIntlClientProvider
                locale={locale}
                messages={MESSAGES[locale]}
                timeZone="Europe/Warsaw"
            >
                {children}
            </NextIntlClientProvider>
        );
    }
    return renderHook(() => useHeaderPlace(profile), { wrapper: Wrapper }).result.current;
}

function inCities(cities: readonly string[]): Profile {
    return {
        coverage: 'local',
        locations: cities.map((city, index) =>
            makeLocation({ id: `loc-${index}`, city, isMainLocation: index === 0 }),
        ),
    };
}

describe('useHeaderPlace', () => {
    it('ponad 3 miasta: trzy miasta, "i N inne" i liczba lokalizacji', () => {
        expect(headerPlace(chainServiceFixture)).toBe(
            'Poznań, Bydgoszcz, Chojnice i 2 inne · 8 lokalizacji',
        );
    });

    it.each([
        ['en', 'Poznań, Bydgoszcz, Chojnice and 2 more · 8 locations'],
        ['ru', 'Poznań, Bydgoszcz, Chojnice и ещё 2 города · 8 адресов'],
        ['uk', 'Poznań, Bydgoszcz, Chojnice та ще 2 міста · 8 адрес'],
    ] as const)('%s: odmiana liczby miast i lokalizacji', (locale, expected) => {
        expect(headerPlace(chainServiceFixture, locale)).toBe(expected);
    });

    it.each([
        [['Kraków', 'Gdańsk', 'Łódź', 'Lublin'], 'Kraków, Gdańsk, Lublin i 1 inne · 4 lokalizacje'],
        [['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 'A, B, C i 5 innych · 8 lokalizacji'],
    ])('pl: odmiana "inne" dla %p', (cities, expected) => {
        expect(headerPlace(inCities(cities))).toBe(expected);
    });

    it('do 3 miast: wszystkie miasta bez "inne"', () => {
        expect(headerPlace(localServiceFixture)).toBe('Warszawa, Piaseczno · 2 lokalizacje');
    });

    it('jedno miasto, kilka lokalizacji: miasto i liczba', () => {
        expect(headerPlace(inCities(['Warszawa', 'Warszawa']))).toBe('Warszawa · 2 lokalizacje');
    });

    it('jedna lokalizacja: samo miasto, jak dotad', () => {
        expect(headerPlace({ ...localServiceFixture, locations: [makeLocation()] })).toBe(
            'Warszawa',
        );
    });

    it('wpis online: bez tekstu', () => {
        expect(headerPlace(onlineServiceFixture)).toBeNull();
    });
});
