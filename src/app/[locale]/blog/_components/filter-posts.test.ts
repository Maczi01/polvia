import type { PostMetadata } from '@/types';

import { filterPosts } from './filter-posts';

function post(overrides: Partial<PostMetadata>): PostMetadata {
    return { slug: 'wpis', locale: 'pl', ...overrides };
}

const PESEL = post({ slug: 'pesel', title: 'Jak uzyskać numer PESEL', tags: ['Urzędy'] });
const ZUS = post({
    slug: 'zus',
    title: 'Składki ZUS',
    summary: 'Ubezpieczenie zdrowotne',
    author: 'Łukasz',
    tags: ['Praca'],
});

describe('filterPosts', () => {
    it('zapytanie bez polskich znakow trafia tytul z polskimi znakami', () => {
        expect(filterPosts([PESEL, ZUS], 'uzyskac', [])).toEqual([PESEL]);
    });

    it('szuka w streszczeniu i autorze, bez wzgledu na polskie znaki', () => {
        expect(filterPosts([PESEL, ZUS], 'zdrowotne', [])).toEqual([ZUS]);
        expect(filterPosts([PESEL, ZUS], 'lukasz', [])).toEqual([ZUS]);
    });

    it('filtruje po aktywnych tagach', () => {
        expect(filterPosts([PESEL, ZUS], '', ['Praca'])).toEqual([ZUS]);
    });

    it('laczy tekst i tagi warunkiem I', () => {
        expect(filterPosts([PESEL, ZUS], 'pesel', ['Praca'])).toEqual([]);
    });

    it('bez zapytania i tagow zwraca wszystkie wpisy', () => {
        expect(filterPosts([PESEL, ZUS], '   ', [])).toEqual([PESEL, ZUS]);
    });
});
