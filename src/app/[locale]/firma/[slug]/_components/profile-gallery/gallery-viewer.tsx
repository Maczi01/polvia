'use client';

import {
    createContext,
    type ReactElement,
    type ReactNode,
    useCallback,
    useContext,
    useRef,
    useState,
} from 'react';

import type { ProfileImage } from '../service-profile-types';
import { GalleryLightbox } from './gallery-lightbox';

/**
 * Wyspa kliencka galerii: stan podgladu i `<dialog>`. Siatka miniatur zostaje
 * w Server Component (`ProfileGallery`) — klientem sa tylko przyciski otwierajace
 * (`GalleryOpenButton`) i sam lightbox.
 */

type GalleryViewerContextValue = (index: number) => void;

const GalleryViewerContext = createContext<GalleryViewerContextValue | null>(null);

type GalleryViewerProps = {
    /** Wszystkie zdjecia podgladu (takze ukryte za licznikiem „+N”). */
    images: readonly ProfileImage[];
    children: ReactNode;
};

export function GalleryViewer({ images, children }: GalleryViewerProps): ReactElement {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const total = images.length;

    const handleOpen = useCallback((index: number): void => {
        setActiveIndex(index);
        dialogRef.current?.showModal();
    }, []);

    const handleStep = (delta: number): void => {
        setActiveIndex(index => (index === null ? null : (index + delta + total) % total));
    };

    return (
        <GalleryViewerContext.Provider value={handleOpen}>
            {children}
            <GalleryLightbox
                ref={dialogRef}
                images={images}
                activeIndex={activeIndex}
                onStep={handleStep}
                onRequestClose={() => dialogRef.current?.close()}
                onClose={() => setActiveIndex(null)}
            />
        </GalleryViewerContext.Provider>
    );
}

type GalleryOpenButtonProps = {
    index: number;
    /** Dostepna nazwa przycisku (tlumaczenie z serwera). */
    label: string;
    className?: string;
    /** Miniatura renderowana na serwerze. */
    children: ReactNode;
};

/** Miniatura-przycisk otwierajaca podglad; musi lezec wewnatrz `GalleryViewer`. */
export function GalleryOpenButton({
    index,
    label,
    className,
    children,
}: GalleryOpenButtonProps): ReactElement {
    const open = useContext(GalleryViewerContext);

    return (
        <button
            type="button"
            onClick={() => open?.(index)}
            aria-label={label}
            className={className}
        >
            {children}
        </button>
    );
}
