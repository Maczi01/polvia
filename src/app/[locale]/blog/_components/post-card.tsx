'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Calendar, User } from 'lucide-react';
import { formatDate } from '@/lib/consts';
import { imgAlt, resolveCover } from '@/lib/utilities';
import { PostMetadata } from '@/types';
import { useState } from 'react';
import { useParallaxHover } from '@/hooks/use-parallax-hover';
import { tagChipStyle, tagLink, tagRowStyle } from '@/app/[locale]/blog/_components/tag-styles';
import { useTranslations } from 'next-intl';

// Small helper for line clamp without Tailwind slash tokens
const clamp = (lines: number): React.CSSProperties => ({
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
});

export default function PostCard({ post, locale }: { post: PostMetadata; locale: string }) {
    const cover = resolveCover(post);
    const [hover, setHover] = useState(false);
    const t = useTranslations('Blog');


    const { containerRef, planeRef, overlayRef } = useParallaxHover({
        scale: 1.07, // a touch stronger on grid
        rotate: 4,
        translate: 12,
        easing: 0.14,
    });

    return (
        <Link
            href={`/${locale}/blog/${post.slug}`}
            className="block"
            style={{ display: 'block', height: '100%' }}
        >
            <article
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                }}
                style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 16,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: '#ffffff', // white card
                    color: '#0f172a', // base text dark (slate-900)
                    overflow: 'hidden',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                }}
            >
                {/* Compact image: 4:3 keeps the card shorter than 16:9 */}
                {cover && (
                    <div
                        ref={containerRef}
                        style={{
                            position: 'relative',
                            width: '100%',
                            paddingTop: '75%', // 4:3
                            overflow: 'hidden',
                            perspective: '900px', // depth!
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                        }}
                    >
                        <div
                            ref={planeRef}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                willChange: 'transform',
                                transformOrigin: 'center',
                                transition: 'transform 200ms ease',
                            }}
                        >
                            <Image
                                src={cover}
                                alt={imgAlt(post.coverImage, post.title ?? '')}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                style={{ objectFit: 'cover' }}
                                priority={false}
                            />
                        </div>
                        {Array.isArray(post.tags) && post.tags.length > 0 && (
                            <div style={tagRowStyle}>
                                {post.tags.slice(0, 3).map((t) => (
                                    <Link key={t} href={tagLink(locale, t)} style={tagChipStyle} onClick={(e) => e.stopPropagation()}>
                                        #{t}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div
                    style={{
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        flexGrow: 1,
                    }}
                >
                    {/* meta */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: 12,
                            color: '#64748b', // slate-500
                            marginTop: 2,
                        }}
                    >
                        {post.author && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <User size={14} />
                                {post.author}
                            </span>
                        )}
                        {post.publishedAt && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={14} />
                                <time dateTime={post.publishedAt}>
                                    {formatDate(post.publishedAt)}
                                </time>
                            </span>
                        )}
                    </div>

                    {/* title */}
                    <h3
                        style={{
                            margin: 0,
                            fontSize: 16,
                            lineHeight: 1.35,
                            fontWeight: 700,
                            color: '#0f172a', // slate-900
                            ...clamp(2),
                        }}
                        title={post.title}
                    >
                        {post.title}
                    </h3>

                    {/* summary */}
                    {post.summary && (
                        <p
                            style={{
                                margin: 0,
                                fontSize: 14,
                                lineHeight: 1.45,
                                color: '#334155', // slate-700
                                ...clamp(3),
                            }}
                            title={post.summary}
                        >
                            {post.summary}
                        </p>
                    )}

                    {/* CTA pinned at bottom */}
                    <div style={{ marginTop: 'auto' }}>
                        <span
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#065f46', // emerald-800-ish
                            }}
                        >
                            {t('readMore')}
                        </span>
                    </div>
                </div>
            </article>
        </Link>
    );
}
