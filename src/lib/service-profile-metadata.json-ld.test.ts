import {
    buildProfileJsonLd,
    type JsonLdLocation,
    serializeJsonLd,
} from './service-profile-metadata';

function location(overrides: Partial<JsonLdLocation> = {}): JsonLdLocation {
    return {
        street: 'ul. Grochowska 278',
        city: 'Warszawa',
        postcode: '03-841',
        voivodeship: 'mazowieckie',
        latitude: 52.2481,
        longitude: 21.0927,
        phoneNumber: '+48 600 100 200',
        email: 'biuro@example.pl',
        openingHours: {
            monday: { open: '08:00', close: '18:00' },
            saturday: { open: '09:00', close: '13:00' },
        },
        ...overrides,
    };
}

describe('buildProfileJsonLd', () => {
    const common = {
        name: 'Mistrz Remontu',
        description: 'Remonty',
        url: 'https://polvia.pl/firma/mistrz-remontu',
        imageUrl: 'https://polvia.pl/services/logo.png',
        sameAs: ['https://facebook.com/mistrz'],
    };

    it('wpis lokalny to LocalBusiness z PostalAddress, geo i godzinami', () => {
        const jsonLd = buildProfileJsonLd({ ...common, coverage: 'local', location: location() });

        expect(jsonLd['@type']).toBe('LocalBusiness');
        expect(jsonLd.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: 'ul. Grochowska 278',
            addressLocality: 'Warszawa',
            postalCode: '03-841',
            addressRegion: 'mazowieckie',
            addressCountry: 'PL',
        });
        expect(jsonLd.geo).toEqual({
            '@type': 'GeoCoordinates',
            latitude: 52.2481,
            longitude: 21.0927,
        });
        expect(jsonLd.openingHoursSpecification).toEqual([
            {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: 'https://schema.org/Monday',
                opens: '08:00',
                closes: '18:00',
            },
            {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: 'https://schema.org/Saturday',
                opens: '09:00',
                closes: '13:00',
            },
        ]);
        expect(jsonLd.telephone).toBe('+48 600 100 200');
        expect(jsonLd.sameAs).toEqual(['https://facebook.com/mistrz']);
    });

    it('wpis online to Organization bez address, geo i godzin', () => {
        const jsonLd = buildProfileJsonLd({ ...common, coverage: 'online', location: location() });

        expect(jsonLd['@type']).toBe('Organization');
        expect(jsonLd).not.toHaveProperty('address');
        expect(jsonLd).not.toHaveProperty('geo');
        expect(jsonLd).not.toHaveProperty('openingHoursSpecification');
        expect(jsonLd.email).toBe('biuro@example.pl');
    });

    it('wpis local bez lokalizacji to LocalBusiness bez adresu, nie Organization', () => {
        const jsonLd = buildProfileJsonLd({ ...common, coverage: 'local', location: null });

        expect(jsonLd['@type']).toBe('LocalBusiness');
        expect(jsonLd).not.toHaveProperty('address');
        expect(jsonLd).not.toHaveProperty('geo');
        expect(jsonLd).not.toHaveProperty('openingHoursSpecification');
        expect(jsonLd.name).toBe('Mistrz Remontu');
    });

    it('wpis bez wspolrzednych nie ma geo, a puste pola sa pominiete', () => {
        const jsonLd = buildProfileJsonLd({
            ...common,
            description: null,
            imageUrl: null,
            sameAs: [],
            coverage: 'hybrid',
            location: location({ latitude: null, longitude: null, openingHours: {}, email: null }),
        });

        expect(jsonLd['@type']).toBe('LocalBusiness');
        expect(jsonLd).not.toHaveProperty('geo');
        expect(jsonLd).not.toHaveProperty('description');
        expect(jsonLd).not.toHaveProperty('image');
        expect(jsonLd).not.toHaveProperty('sameAs');
        expect(jsonLd).not.toHaveProperty('email');
        expect(jsonLd).not.toHaveProperty('openingHoursSpecification');
    });
});

describe('serializeJsonLd', () => {
    it('nie przepuszcza </script> z opisu i daje poprawny JSON', () => {
        const data = { description: 'Opis</script><script>alert(1)</script>' };

        const serialized = serializeJsonLd(data);

        expect(serialized).not.toContain('</script>');
        expect(serialized).not.toContain('<');
        expect(JSON.parse(serialized)).toEqual(data);
    });
});
