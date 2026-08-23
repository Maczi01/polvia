import {
    coverageValues,
    parseRawServiceData,
    serviceSchema,
} from './_service-schema';

/**
 * Buduje FormData minimalnie poprawnego wpisu, nadpisywalny per test.
 * `null` jako wartosc oznacza "nie ustawiaj tego pola wcale" — czyli symuluje
 * pole nieobecne w formularzu, co FormData.get() zwraca jako null.
 */
function buildFormData(overrides: Record<string, string | null> = {}): FormData {
    // Formularz dashboardu renderuje wszystkie inputy, wiec realne zgloszenie
    // posyla '' dla pol niewypelnionych — nie pomija ich. Odwzorowujemy to,
    // bo wzorzec `z.string().optional().or(z.literal(''))` uzywany w tym repo
    // dla pol opcjonalnych NIE przyjmuje nulla.
    const base: Record<string, string> = {
        name: 'Biuro Testowe',
        category: 'financial',
        coverage: 'local',
        status: 'active',
        city: 'Warszawa',
        latitude: '52.2297',
        longitude: '21.0122',
        webpage: '',
        nip: '',
        whatsappNumber: '',
        street: '',
        voivodeship: '',
        postcode: '',
        phoneNumber: '',
        email: '',
        namePl: '',
        nameEn: '',
        nameUk: '',
        nameRu: '',
        descriptionPl: '',
        descriptionEn: '',
        descriptionUk: '',
        descriptionRu: '',
        'socials.instagram': '',
        'socials.telegram': '',
        'socials.tiktok': '',
        'socials.facebook': '',
        'socials.youtube': '',
        'socials.viber': '',
        'socials.whatsapp': '',
    };

    const merged: Record<string, string | null> = { ...base, ...overrides };
    const formData = new FormData();
    for (const [key, value] of Object.entries(merged)) {
        if (value !== null) formData.append(key, value);
    }
    return formData;
}

const parse = (overrides?: Record<string, string | null>) =>
    serviceSchema.safeParse(parseRawServiceData(buildFormData(overrides)));

const errorPaths = (result: ReturnType<typeof parse>): string[] => {
    if (result.success) return [];
    return result.error.issues.map(issue => issue.path.join('.'));
};

describe('serviceSchema — zasieg obslugi', () => {
    describe('wspolrzedne przy zasiegu online', () => {
        it('puste wspolrzedne daja null, nie 0', () => {
            const result = parse({ coverage: 'online', latitude: '', longitude: '' });

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.latitude).toBeNull();
            expect(result.data.longitude).toBeNull();
        });

        it('nieobecne pola wspolrzednych daja null, nie 0', () => {
            const result = parse({ coverage: 'online', latitude: null, longitude: null });

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.latitude).toBeNull();
            expect(result.data.longitude).toBeNull();
        });

        it('podane wspolrzedne sa nadal parsowane jako liczby', () => {
            const result = parse({ coverage: 'online' });

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.latitude).toBeCloseTo(52.2297);
            expect(result.data.longitude).toBeCloseTo(21.0122);
        });

        it('odrzuca wspolrzedne poza zakresem', () => {
            const result = parse({ latitude: '91' });

            expect(result.success).toBe(false);
            expect(errorPaths(result)).toContain('latitude');
        });

        it('odrzuca wspolrzedne, ktore nie sa liczba', () => {
            const result = parse({ latitude: 'gdzies-tam' });

            expect(result.success).toBe(false);
            expect(errorPaths(result)).toContain('latitude');
        });
    });

    describe('miasto jest wymagane poza zasiegiem local', () => {
        it('online bez miasta jest odrzucany z bledem na polu city', () => {
            const result = parse({ coverage: 'online', city: '', latitude: '', longitude: '' });

            expect(result.success).toBe(false);
            expect(errorPaths(result)).toContain('city');
        });

        it('hybrid bez miasta jest odrzucany z bledem na polu city', () => {
            const result = parse({ coverage: 'hybrid', city: '' });

            expect(result.success).toBe(false);
            expect(errorPaths(result)).toContain('city');
        });

        it('miasto z samych spacji nie zalicza sie jako podane', () => {
            const result = parse({ coverage: 'online', city: '   ', latitude: '', longitude: '' });

            expect(result.success).toBe(false);
            expect(errorPaths(result)).toContain('city');
        });

        it('local bez miasta przechodzi', () => {
            const result = parse({ coverage: 'local', city: '' });

            expect(result.success).toBe(true);
        });
    });

    describe('wspolrzedne sa wymagane dla wpisow odwiedzalnych', () => {
        it('local bez wspolrzednych jest odrzucany', () => {
            const result = parse({ coverage: 'local', latitude: '', longitude: '' });

            expect(result.success).toBe(false);
            expect(errorPaths(result)).toContain('latitude');
            expect(errorPaths(result)).toContain('longitude');
        });

        it('hybrid bez wspolrzednych jest odrzucany — ma pin na mapie', () => {
            const result = parse({ coverage: 'hybrid', latitude: '', longitude: '' });

            expect(result.success).toBe(false);
            expect(errorPaths(result)).toContain('latitude');
        });

        it('hybrid z wspolrzednymi i miastem przechodzi', () => {
            const result = parse({ coverage: 'hybrid' });

            expect(result.success).toBe(true);
        });
    });

    describe('wartosc zasiegu', () => {
        it('brak pola coverage domyslnie daje local', () => {
            const result = parse({ coverage: null });

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.coverage).toBe('local');
        });

        it('odrzuca wartosc spoza enuma', () => {
            const result = parse({ coverage: 'zdalnie' });

            expect(result.success).toBe(false);
            expect(errorPaths(result)).toContain('coverage');
        });

        it('przyjmuje kazda wartosc z coverageEnum', () => {
            for (const coverage of coverageValues) {
                const result = parse({
                    coverage,
                    // online nie wymaga wspolrzednych, pozostale tak — podajemy zawsze
                    city: 'Warszawa',
                });
                expect(result.success).toBe(true);
            }
        });
    });
});
