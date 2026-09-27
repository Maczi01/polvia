import { foldForSearch } from '@/lib/search-text';
import type { PostMetadata } from '@/types';

/**
 * Filtr listy wpisow bloga: tekst (tytul, streszczenie, autor) bez polskich znakow
 * po obu stronach ORAZ co najmniej jeden z aktywnych tagow.
 */
export function filterPosts(
    posts: PostMetadata[],
    query: string,
    activeTags: string[],
): PostMetadata[] {
    const q = foldForSearch(query.trim());

    return posts.filter(post => {
        const matchesText = q
            ? foldForSearch(
                  `${post.title ?? ''} ${post.summary ?? ''} ${post.author ?? ''}`,
              ).includes(q)
            : true;
        const matchesTags =
            activeTags.length > 0 ? (post.tags ?? []).some(tag => activeTags.includes(tag)) : true;
        return matchesText && matchesTags;
    });
}
