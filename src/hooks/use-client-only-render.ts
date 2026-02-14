import { useEffect, useState } from 'react';

export const useClientOnlyRender = () => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    return isMounted;
};
