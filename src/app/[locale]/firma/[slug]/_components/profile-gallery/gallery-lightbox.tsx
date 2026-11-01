'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactElement, Ref } from 'react';

import type { ProfileImage } from '../service-profile-types';

const CONTROL =
    'flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

type GalleryLightboxProps = {
    ref: Ref<HTMLDialogElement>;
    images: readonly ProfileImage[];
    activeIndex: number | null;
    onStep: (delta: number) => void;
    onRequestClose: () => void;
    /** Zdarzenie `close` dialogu (przycisk Zamknij albo Escape). */
    onClose: () => void;
};

/**
 * Natywny `<dialog>` w trybie modalnym: pulapka fokusu, Escape i powrot fokusu
 * do miniatury daje przegladarka — bez biblioteki lightboxa.
 */
export function GalleryLightbox({
    ref,
    images,
    activeIndex,
    onStep,
    onRequestClose,
    onClose,
}: GalleryLightboxProps): ReactElement {
    const t = useTranslations('ServiceProfile');
    const image = activeIndex === null ? null : images[activeIndex];
    const hasMany = images.length > 1;

    return (
        <dialog
            ref={ref}
            aria-label={t('galleryDialog')}
            onClose={onClose}
            className="m-auto size-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/90"
        >
            {image && activeIndex !== null && (
                <div className="flex h-full flex-col p-3 md:p-6">
                    <div className="flex items-center justify-between gap-4 text-white">
                        <p className="text-sm tabular-nums" aria-live="polite">
                            {t('galleryCounter', { index: activeIndex + 1, total: images.length })}
                        </p>
                        <button
                            type="button"
                            className={CONTROL}
                            onClick={onRequestClose}
                            aria-label={t('galleryClose')}
                        >
                            <X size={22} aria-hidden="true" />
                        </button>
                    </div>
                    <figure className="relative mt-3 flex min-h-0 flex-1 flex-col">
                        <div className="relative min-h-0 flex-1">
                            <Image
                                src={image.src}
                                alt={image.alt}
                                fill
                                sizes="100vw"
                                className="object-contain"
                            />
                        </div>
                        <figcaption className="mt-3 text-center text-sm text-white/80">
                            {image.alt}
                        </figcaption>
                    </figure>
                    {hasMany && (
                        <div className="mt-3 flex justify-center gap-3">
                            <button
                                type="button"
                                className={CONTROL}
                                onClick={() => onStep(-1)}
                                aria-label={t('galleryPrevious')}
                            >
                                <ChevronLeft size={24} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className={CONTROL}
                                onClick={() => onStep(1)}
                                aria-label={t('galleryNext')}
                            >
                                <ChevronRight size={24} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </dialog>
    );
}
