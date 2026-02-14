import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export const useDebouncedState = <T>(
    initialValue: T,
    delay = 300,
): [T, T, Dispatch<SetStateAction<T>>] => {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return [value, debouncedValue, setValue];
};
