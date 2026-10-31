import type { Category } from '@/lib/categories';

/** Ile pozycji pokazuje sekcja „Podobne firmy” na darmowym profilu. */
export const SIMILAR_SERVICES_LIMIT = 6;

/** Wiersz „Podobnych firm” z bazy (`getSimilarServices`), przed mapowaniem na widok profilu. */
export type SimilarServiceRow = {
    serviceId: string;
    /** Slug uslugi — adres `/firma/<slug>`. */
    slug: string;
    /** Nazwa w danym locale (fallback: nazwa bazowa). */
    name: string;
    image: string | null;
    /** Miasto glownej lokalizacji (albo pierwszej, gdy zadna nie jest glowna). */
    city: string | null;
    category: string;
};

/** Profil, dla ktorego szukamy podobnych firm — strona ma te dane z `getServiceProfile`. */
export type SimilarServicesSource = {
    serviceId: string;
    category: Category;
    /** Miasto glownej lokalizacji zrodla; `null` = bez promowania firm z tego samego miasta. */
    city: string | null;
};
