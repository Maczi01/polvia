import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { PREMIUM_GALLERY_MAX } from '@/lib/premium-templates';
import { cn } from '@/lib/utilities';

import { ProfileSection } from '../profile-section/profile-section';
import type { ProfileImage } from '../service-profile-types';
import { GalleryOpenButton, GalleryViewer } from './gallery-viewer';

/**
 * - `mosaic`: pierwsze zdjecie 2x2, reszta siatka — szablon Galeria
 * - `grid`: rowna siatka — szablon Klasyczny
 * - `strip`: rzad miniatur — szablon Profesjonalny
 */
export type GalleryLayout = 'mosaic' | 'grid' | 'strip';

const LAYOUT_LIST: Record<GalleryLayout, string> = {
    mosaic: 'grid grid-cols-2 auto-rows-[150px] gap-2 sm:auto-rows-[200px] md:grid-cols-4 md:gap-3',
    grid: 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3',
    strip: 'grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3',
};

const LAYOUT_ITEM: Record<GalleryLayout, string> = {
    mosaic: 'first:col-span-2 first:row-span-2',
    grid: 'aspect-[4/3]',
    strip: 'aspect-[4/3]',
};

const LAYOUT_SIZES: Record<GalleryLayout, string> = {
    mosaic: '(min-width: 768px) 50vw, 100vw',
    grid: '(min-width: 640px) 33vw, 50vw',
    strip: '(min-width: 768px) 25vw, 50vw',
};

type ProfileGalleryProps = {
    images: readonly ProfileImage[];
    layout: GalleryLayout;
    /** Ile miniatur pokazac; na ostatniej licznik „+N”, a podglad ma wszystkie zdjecia. */
    previewLimit?: number;
    className?: string;
    titleClassName?: string;
};

type GalleryThumbnailProps = {
    image: ProfileImage;
    index: number;
    label: string;
    layout: GalleryLayout;
    /** Licznik „+N” na miniaturze; `0` — bez licznika. */
    moreCount: number;
};

function GalleryThumbnail({
    image,
    index,
    label,
    layout,
    moreCount,
}: GalleryThumbnailProps): ReactElement {
    return (
        <li className={cn('relative', LAYOUT_ITEM[layout])}>
            <GalleryOpenButton
                index={index}
                label={label}
                className="group absolute inset-0 overflow-hidden rounded-xl bg-gray-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/60 dark:bg-gray-800"
            >
                <Image
                    src={image.src}
                    alt=""
                    fill
                    sizes={LAYOUT_SIZES[layout]}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {moreCount > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-bold text-white"
                    >
                        +{moreCount}
                    </span>
                )}
            </GalleryOpenButton>
        </li>
    );
}

/**
 * Galeria jako Server Component: siatka i miniatury renderuja sie na serwerze, a do klienta
 * trafiaja tylko przyciski otwierajace podglad i lightbox (`GalleryViewer`).
 */
export function ProfileGallery({
    images,
    layout,
    previewLimit,
    className,
    titleClassName,
}: ProfileGalleryProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');

    const allImages = images.slice(0, PREMIUM_GALLERY_MAX);
    if (allImages.length === 0) return null;

    const thumbnails = previewLimit ? allImages.slice(0, previewLimit) : allImages;
    const hiddenCount = allImages.length - thumbnails.length;
    const total = allImages.length;

    return (
        <ProfileSection
            id="gallery"
            title={t('gallery')}
            className={className}
            titleClassName={titleClassName}
        >
            <GalleryViewer images={allImages}>
                <ul className={LAYOUT_LIST[layout]}>
                    {thumbnails.map((image, index) => (
                        <GalleryThumbnail
                            key={image.src}
                            image={image}
                            index={index}
                            label={t('galleryOpen', { index: index + 1, total, alt: image.alt })}
                            layout={layout}
                            moreCount={index === thumbnails.length - 1 ? hiddenCount : 0}
                        />
                    ))}
                </ul>
            </GalleryViewer>
        </ProfileSection>
    );
}
