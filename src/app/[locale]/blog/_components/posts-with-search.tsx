'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import Link from 'next/link';
import type { PostMetadata } from '@/types';
import { Input } from '@/components/ui/input/input';
import FeaturedCard from './featured-card';
import PostCard from './post-card';

const pill = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? '#065f46' : 'rgba(0,0,0,0.04)',
    color: active ? '#ffffff' : '#0f172a',
    border: active ? '1px solid rgba(6,95,70,0.9)' : '1px solid rgba(0,0,0,0.08)',
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
});

export default function PostsWithSearch({
                                            posts,
                                            locale,
                                            translations,
                                        }: {
    posts: PostMetadata[];
    locale: string;
    translations: { searchPlaceholder: string; noPostsFound: string; readMore: string };
}) {
    const [query, setQuery] = useState('');
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // derive all unique tags
    const allTags = useMemo(() => {
        const set = new Set<string>();
        posts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [posts]);

    // state for selected tags (from URL on mount & changes)
    const [activeTags, setActiveTags] = useState<string[]>([]);
    useEffect(() => {
        const tagParam = searchParams.get('tag');
        if (!tagParam) { setActiveTags([]); return; }
        const next = tagParam.split(',').map(decodeURIComponent).map(s => s.trim()).filter(Boolean);
        setActiveTags(next);
    }, [searchParams]);

    const setUrlTags = (tags: string[]) => {
        const usp = new URLSearchParams(searchParams.toString());
        if (tags.length > 0) usp.set('tag', tags.join(','));
        else usp.delete('tag');
        router.replace(`${pathname}?${usp.toString()}`);
    };

    const toggleTag = (t: string) => {
        setActiveTags(prev => {
            const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t];
            setUrlTags(next);
            return next;
        });
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return posts.filter(p => {
            const matchesText = q
                ? (`${p.title ?? ''} ${p.summary ?? ''} ${p.author ?? ''}`).toLowerCase().includes(q)
                : true;
            const matchesTags = activeTags.length > 0
                ? (p.tags || []).some(t => activeTags.includes(t))
                : true;
            return matchesText && matchesTags;
        });
    }, [posts, query, activeTags]);

    return (
        <div>
            {/* Search */}
            <div style={{ maxWidth: 640, margin: '0 auto 16px' }}>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }} />
                    <Input
                        icon
                        type="text"
                        placeholder={translations.searchPlaceholder}
                        className="h-11 w-full rounded-lg border pl-10"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onClear={() => setQuery('')}
                        clearable
                    />
                </div>
            </div>

            {/* Tag filter bar */}
            {allTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                    {allTags.map((t) => (
                        <button key={t} onClick={() => toggleTag(t)} style={pill(activeTags.includes(t))}>
                            #{t}
                        </button>
                    ))}
                </div>
            )}

            {/* Featured - hidden on mobile */}
            {filtered.length > 0 && (
                <div className="featured-desktop-only">
                    <FeaturedCard post={filtered[0]} locale={locale} />
                </div>
            )}

            {/* Grid */}
            {filtered.length > 0 ? (
                <>
                    <style>{`
                        .blog-grid { 
                            display: grid; 
                            gap: 24px; 
                            grid-template-columns: 1fr; 
                        }
                        @media (min-width: 768px) { 
                            .blog-grid { 
                                grid-template-columns: 1fr 1fr; 
                            } 
                        }
                        @media (min-width: 1280px) { 
                            .blog-grid { 
                                grid-template-columns: 1fr 1fr 1fr; 
                            } 
                        }
                        
                        /* Hide featured card on mobile */
                        .featured-desktop-only {
                            display: block;
                            margin-bottom: 24px;
                        }
                        @media (max-width: 767px) {
                            .featured-desktop-only {
                                display: none !important;
                            }
                        }
                    `}</style>

                    <div className="blog-grid">
                        {/* On mobile: show all posts */}
                        {/* On desktop: show posts starting from index 1 (skip the featured post) */}
                        {filtered.map((p, index) => (
                            <div
                                key={p.slug}
                                className={index === 0 ? "mobile-only-post" : ""}
                            >
                                <PostCard post={p} locale={locale} />
                            </div>
                        ))}
                    </div>

                    <style>{`
                        /* Hide the first post on desktop since it's shown as featured */
                        @media (min-width: 768px) {
                            .mobile-only-post {
                                display: none;
                            }
                        }
                        
                        /* Ensure first post is visible on mobile */
                        @media (max-width: 767px) {
                            .mobile-only-post {
                                display: block;
                            }
                        }
                    `}</style>
                </>
            ) : (
                <div className="py-16 text-center">
                    <p className="text-lg">{translations.noPostsFound}</p>
                </div>
            )}
        </div>
    );
}