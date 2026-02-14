import { useEffect, useState } from 'react';

export const useIsMobile = ({ breakpoint }: { breakpoint: number }) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        function checkSize() {
            setIsMobile(window.innerWidth < breakpoint);
        }
        checkSize();
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, [breakpoint]);

    return isMobile;
};
