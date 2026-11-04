import { getAddressedLocations } from './profile-helpers';
import {
    chainServiceFixture,
    localServiceFixture,
    makeLocation,
    onlineServiceFixture,
} from './profile-fixtures';
import {
    getLocationSummary,
    groupLocationsByCity,
    hasMultipleLocations,
    splitVisibleGroups,
} from './profile-location-groups';
import type { ProfileLocation } from './service-profile-types';

function cityLocations(cities: readonly (string | null)[]): ProfileLocation[] {
    return cities.map((city, index) =>
        makeLocation({ id: `loc-${index}`, city, isMainLocation: index === 0 }),
    );
}

describe('groupLocationsByCity', () => {
    it('miasto glowne pierwsze, potem liczba lokalizacji malejaco, przy remisie alfabetycznie', () => {
        const groups = groupLocationsByCity(getAddressedLocations(chainServiceFixture));

        expect(groups.map(group => [group.city, group.locations.length])).toEqual([
            ['Poznań', 3],
            ['Bydgoszcz', 2],
            ['Chojnice', 1],
            ['Szczecin', 1],
            ['Wrocław', 1],
        ]);
    });

    it('w grupie glowna lokalizacja pierwsza, reszta w kolejnosci danych', () => {
        const [poznan] = groupLocationsByCity(getAddressedLocations(chainServiceFixture));

        expect(poznan?.locations.map(location => location.id)).toEqual([
            'loc-poz-main',
            'loc-poz-2',
            'loc-poz-3',
        ]);
    });

    it('miasto glowne zostaje pierwsze, nawet gdy inne ma wiecej punktow', () => {
        const groups = groupLocationsByCity(cityLocations(['Łódź', 'Gdańsk', 'Gdańsk']));

        expect(groups.map(group => group.city)).toEqual(['Łódź', 'Gdańsk']);
    });

    it('sortuje po polsku (Ł po L) i laczy miasta rozniace sie spacjami; adresy bez miasta na koncu', () => {
        const groups = groupLocationsByCity(
            cityLocations(['Kraków', null, 'Łomża', 'Lublin', ' Kraków ']),
        );

        expect(groups.map(group => group.city)).toEqual(['Kraków', 'Lublin', 'Łomża', null]);
        expect(groups[0]?.locations).toHaveLength(2);
    });

    it('pusta lista daje brak grup', () => {
        expect(groupLocationsByCity([])).toEqual([]);
    });
});

describe('getLocationSummary', () => {
    it('kilka miast: rozne miasta w kolejnosci grup i liczba lokalizacji', () => {
        expect(getLocationSummary(chainServiceFixture)).toEqual({
            cities: ['Poznań', 'Bydgoszcz', 'Chojnice', 'Szczecin', 'Wrocław'],
            locationCount: 8,
        });
    });

    it('jedno miasto, wiele lokalizacji: jedno miasto', () => {
        const profile = {
            coverage: 'local' as const,
            locations: cityLocations(['Warszawa', 'Warszawa']),
        };

        expect(getLocationSummary(profile)).toEqual({ cities: ['Warszawa'], locationCount: 2 });
    });

    it('jedna lokalizacja', () => {
        const profile = { ...localServiceFixture, locations: [makeLocation()] };

        expect(getLocationSummary(profile)).toEqual({ cities: ['Warszawa'], locationCount: 1 });
    });

    it('wpis online: brak miast i lokalizacji, nawet z adresem w danych', () => {
        const profile = { ...onlineServiceFixture, locations: cityLocations(['Gdańsk', 'Sopot']) };

        expect(getLocationSummary(profile)).toEqual({ cities: [], locationCount: 0 });
        expect(hasMultipleLocations(profile)).toBe(false);
    });
});

describe('hasMultipleLocations', () => {
    it('prawda dopiero od dwoch adresow', () => {
        expect(hasMultipleLocations(chainServiceFixture)).toBe(true);
        expect(hasMultipleLocations({ ...localServiceFixture, locations: [makeLocation()] })).toBe(
            false,
        );
    });
});

describe('splitVisibleGroups', () => {
    it('do 4 adresow nie zwija niczego', () => {
        const groups = groupLocationsByCity(cityLocations(['A', 'B', 'B', 'C']));

        expect(splitVisibleGroups(groups).hidden).toEqual([]);
    });

    it('pokazuje cale miasta, dopoki suma nie przekroczy 4', () => {
        const groups = groupLocationsByCity(getAddressedLocations(chainServiceFixture));
        const { visible, hidden } = splitVisibleGroups(groups);

        expect(visible.map(group => group.city)).toEqual(['Poznań']);
        expect(hidden.map(group => group.city)).toEqual([
            'Bydgoszcz',
            'Chojnice',
            'Szczecin',
            'Wrocław',
        ]);
    });

    it('zawsze pokazuje pierwsza grupe, nawet ponad limit', () => {
        const groups = groupLocationsByCity(cityLocations(['A', 'A', 'A', 'A', 'A', 'B']));
        const { visible, hidden } = splitVisibleGroups(groups);

        expect(visible.map(group => group.locations.length)).toEqual([5]);
        expect(hidden.map(group => group.city)).toEqual(['B']);
    });

    it('dobiera kolejne miasta do limitu wlacznie', () => {
        const groups = groupLocationsByCity(cityLocations(['A', 'A', 'B', 'C', 'D']));

        expect(splitVisibleGroups(groups).visible.map(group => group.city)).toEqual([
            'A',
            'B',
            'C',
        ]);
    });
});
