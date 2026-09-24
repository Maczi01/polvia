import { GeoJSON, GeoJsonProperties } from 'geojson';

// Typ inferowany ze schematu Drizzle — nie pisany recznie (patrz coding-rules.md).
// Import type-only, wiec nie trafia do bundle'a klienta.
import type { Coverage } from '@/db/schema';

export type { Coverage } from '@/db/schema';

type PointClusterProperties<TProperties extends GeoJsonProperties> = TProperties;
type PointFeature<P> = GeoJSON.Feature<GeoJSON.Point, P>;
export type PointFeatureProperties<TProperties extends GeoJsonProperties> = {
    cluster: false;
} & TProperties;

// export type Service = InferSelectModel<typeof servicesTable>;


export type Path = '/' | '/contact';

export type Coordinates = {
    latitude: number;
    longitude: number;
};

export type MarkerData = Coordinates & {
    name: string;
    image: string;
    place: string;
    category: string;
};

/** Klaster wpisow pod jednym adresem, otwarty jako lista w dymku. */
export type MarkerDataCluster = Coordinates & {
    services: PartialService[];
};

export type ItemPointFeatureProperties = PointFeatureProperties<{
    item: PartialService;
}> & {
    items: PartialService[];
};

export type ItemPointClusterProperties = PointClusterProperties<{
    items: PartialService[];
}>;

export type View = 'map' | 'list' | 'both';

export type PartialService = Omit<Service, 'createdAt' | 'updatedAt' | 'priority' | 'clicks'>;

export type Socials = {
    instagram?: string;
    telegram?: string;
    tiktok?: string;
    facebook?: string;
    youtube?: string;
    viber?: string;
    whatsapp?: string;
    tripadvisor?: string;
    linkedin?: string;
    /** Dawniej Twitter. Klucz `x`, bo taka jest dzis nazwa serwisu i domena. */
    x?: string;
};

export type Service = {
    id: string;
    serviceId: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    description: string | null;
    category: string;
    coverage: Coverage;
    tags: string[] | null;
    city: string | null;
    street: string | null;
    voivodeship: string | null;
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
    openingHours: Record<string, { open: string; close: string }>;
    phoneNumber: string | null;
    email: string | null;
    webpage: string | null;
    image: string | null;
    languages: string[];
    socials: Socials | null;
    whatsappNumber: string | null;
    verified: boolean;
    priority: number;
    clicks: number;
};

export type ScrollableListHandle = {
    scrollToTop: () => void;
    /**
     * Adresowanie po id uslugi, nie po indeksie. Lista ma dwie numeracje —
     * karty (`cardRefs`) i dzieci `VList` (karty ORAZ naglowki sekcji) — a
     * wolajacy z zewnatrz nie ma jak wiedziec, ktorej akurat potrzeba.
     * Rozwiazanie obu nalezy do listy, bo tylko ona zna swoj uklad wierszy.
     */
    scrollToService: (
        serviceId: string,
        options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean },
    ) => void;
};

export type Post = {
    metadata: PostMetadata
    content: string
}

export type ImageField =
     {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
};

export type PostMetadata = {
    slug: string;
    locale: string;

    title?: string;
    summary?: string;

    author?: string;
    publishedAt?: string;

    /** Used in list views / featured hero */
    coverImage?: ImageField | string;

    /** Used for OpenGraph / Twitter */
    image?: ImageField | string;
    tags?: string[];
};



