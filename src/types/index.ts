import { GeoJSON, GeoJsonProperties } from 'geojson';

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

export type MarkerDataCluster = Coordinates & {
    name: string;
    array: PartialService[];
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

export type PartialService = Omit<Service, 'embedding' | 'createdAt' | 'updatedAt' | 'priority' | 'clicks'>;

export type Socials = {
    instagram?: string;
    telegram?: string;
    tiktok?: string;
    facebook?: string;
    youtube?: string;
    viber?: string;
    whatsapp?: string;
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
    tags: string[] | null;
    city: string | null;
    street: string | null;
    voivodeship: string | null;
    postcode: string | null;
    latitude: number;
    longitude: number;
    openingHours: Record<string, { open: string; close: string }>;
    phoneNumber: string | null;
    email: string | null;
    webpage: string | null;
    image: string | null;
    languages: string[];
    socials: Socials | null;
    whatsappNumber: string | null;
    priority: number;
    clicks: number;
};

export type ScrollableListHandle = {
    scrollToTop: () => void;
    scrollToIndex: (index: number) => void;
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



