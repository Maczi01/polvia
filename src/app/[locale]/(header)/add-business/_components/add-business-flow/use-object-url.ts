'use client';

import { useEffect, useState } from 'react';

/** Blob URL podgladu uploadu logo; zwalniany przy zmianie pliku i odmontowaniu. */
export function useObjectUrl(file: File | null): string | null {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (file === null) {
            setUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return url;
}
