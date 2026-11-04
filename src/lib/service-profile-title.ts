import { truncateAtWord } from '@/lib/truncate-at-word';

/** Dlugosc tytulu, ktora Google zwykle pokazuje bez obciecia. */
export const PROFILE_TITLE_MAX_LENGTH = 60;

/**
 * Najkrotsza nazwa firmy, do ktorej tytul z fraza jezykowa skraca nazwe, zanim zrezygnuje
 * z miasta. Nazwa jest potrzebna przy wyszukiwaniu po marce.
 */
export const PROFILE_TITLE_MIN_NAME_LENGTH = 20;

export type ProfileTitleInput = {
    name: string;
    categoryLabel: string;
    /** `null` dla wpisu bez punktu obslugi — tytul jest wtedy bez miasta. */
    city: string | null;
    /**
     * Miasto glowne z liczba pozostalych w locale strony („Poznań i 4 inne miasta”), gdy firma
     * ma punkty w kilku miastach. Zastepuje `city` tylko wtedy, gdy tytul miesci sie w limicie
     * bez skracania; inaczej obowiazuja zwykle reguly z samym `city`.
     */
    cityWithOthers?: string | null;
    siteName: string;
    /**
     * Fraza o jezyku obslugi w locale strony („ukraiński sklep spożywczy”), zastepuje
     * `categoryLabel`. Brak (`null`/pominiete) — firma nie obsluguje zadnego
     * z jezykow frazy (`selectTitleLanguage`).
     */
    titlePhrase?: string | null;
};

/**
 * Glowa tytulu z fraza jezykowa, w kolejnosci wyboru: (1) calosc; (2) nazwa skrocona,
 * ale nie ponizej `PROFILE_TITLE_MIN_NAME_LENGTH`, z fraza i miastem; (3) bez miasta,
 * z nazwa skrocona najwyzej do minimum; gdy i to sie nie miesci — obciety koniec.
 * Fraza jest wiec chroniona zawsze, miasto — dopoki nie kosztuje czytelnosci nazwy.
 */
function buildHeadWithLanguage(
    name: string,
    titlePhrase: string,
    city: string | null,
    headRoom: number,
): string {
    const cleanName = name.replace(/\s+/g, ' ').trim();
    const withoutCity = ` — ${titlePhrase}`;
    const withCity = city?.trim() ? `${withoutCity}, ${city.trim()}` : withoutCity;
    if (cleanName.length + withCity.length <= headRoom) return `${cleanName}${withCity}`;

    const nameRoomWithCity = headRoom - withCity.length;
    if (withCity !== withoutCity && nameRoomWithCity >= PROFILE_TITLE_MIN_NAME_LENGTH) {
        const shortName = truncateAtWord(cleanName, nameRoomWithCity);
        if (shortName.length >= PROFILE_TITLE_MIN_NAME_LENGTH) return `${shortName}${withCity}`;
    }

    const nameRoom = Math.max(headRoom - withoutCity.length, PROFILE_TITLE_MIN_NAME_LENGTH);
    return truncateAtWord(`${truncateAtWord(cleanName, nameRoom)}${withoutCity}`, headRoom);
}

/**
 * `<nazwa> — <kategoria>, <miasto> | <serwis>`; bez miasta: `<nazwa> — <kategoria> | <serwis>`.
 * Sufiks ` | <serwis>` zostaje zawsze.
 *
 * Bez frazy jezykowej za dlugi tytul traci koniec (na granicy slowa, z wielokropkiem) —
 * jak przed wprowadzeniem frazy. Z fraza obcinanie chroni fraze („ukraiński lekarz”
 * to rdzen intencji wyszukiwania): `buildHeadWithLanguage`.
 */
export function buildProfileTitle({
    name,
    categoryLabel,
    city,
    cityWithOthers,
    siteName,
    titlePhrase,
}: ProfileTitleInput): string {
    const suffix = ` | ${siteName}`;
    const headRoom = PROFILE_TITLE_MAX_LENGTH - suffix.length;

    const places = cityWithOthers?.trim();
    if (places) {
        const head = titlePhrase
            ? `${name.replace(/\s+/g, ' ').trim()} — ${titlePhrase}, ${places}`
            : `${name} — ${categoryLabel}, ${places}`;
        if (head.length <= headRoom) return `${head}${suffix}`;
    }

    if (!titlePhrase) {
        const place = city?.trim() ? `, ${city.trim()}` : '';
        return `${truncateAtWord(`${name} — ${categoryLabel}${place}`, headRoom)}${suffix}`;
    }

    return `${buildHeadWithLanguage(name, titlePhrase, city, headRoom)}${suffix}`;
}
