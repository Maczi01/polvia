import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ImageField } from '@/types';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const validateEmail = (email: string): string | null => {
    if (!email) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Invalid email format';
    return null;
};

export const imgSrc = (img?: ImageField | string) =>
    typeof img === 'string' ? img : img?.src;

export const imgAlt = (img: ImageField | string | undefined, fallback = '') =>
    typeof img === 'string' ? fallback : img?.alt ?? fallback;

export const resolveCover = (post: { coverImage?: ImageField | string; image?: ImageField | string }) =>
    imgSrc(post.coverImage) || imgSrc(post.image) || '';