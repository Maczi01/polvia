
import { useQueryState } from 'nuqs';
import { useState, useEffect } from 'react';

type View = 'list' | 'map';

export function useViewState() {
    const [urlView, setUrlView] = useQueryState('view', { defaultValue: 'map' });
    const [animationView, setAnimationView] = useState(urlView);

    const handleViewChange = (view: View) => {
        setAnimationView(view);
        setUrlView(view);
    };

    // Sync animationView with urlView if it changes from another source
    useEffect(() => {
        setAnimationView(urlView);
    }, [urlView]);

    return {
        urlView,
        animationView,
        handleViewChange
    };
}