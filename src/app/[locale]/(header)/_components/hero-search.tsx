'use client';

import { Input } from '@/components/ui/input/input';
import { Button } from '@/components/ui/button/button';
import { Link } from '@/i18n/navigation';
import { MapPin, Plus, Search } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useState, useRef, useId } from 'react';
import { AppPathnames } from '@/i18n/routing';
import { useRouter } from '@/i18n/navigation';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { buildMapUrl, stringifyMapUrl } from '@/lib/map-url-builder';

export const HeroSearch = () => {
    const t = useTranslations('Main');
    const locale = useLocale() as 'pl' | 'en';
    const [searchInput, setSearchInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const router = useRouter();
    const linkRef = useRef<HTMLAnchorElement>(null);
    const isMobile = useIsMobile({ breakpoint: 768 });

    const searchId = useId();
    const searchHelpId = useId();
    const searchErrorId = useId();
    const searchFormId = useId();

    const validateSearch = (query: string): boolean => {
        if (query.length > 0 && query.length < 2) {
            setSearchError('Wyszukiwanie musi zawierać co najmniej 2 znaki');
            return false;
        }
        if (query.length > 100) {
            setSearchError('Wyszukiwanie nie może być dłuższe niż 100 znaków');
            return false;
        }
        setSearchError('');
        return true;
    };

    const performSearch = async (query: string, viewType: 'map' | 'list' = 'list') => {
        if (!validateSearch(query)) return;

        setIsSearching(true);
        setSearchError('');

        try {
            // Build URL with query params (no category/county filters)
            const mapUrl = buildMapUrl({ query: query || undefined, view: viewType }, locale);
            const urlString = stringifyMapUrl(mapUrl);
            await router.push(urlString as AppPathnames);
        } catch (error) {
            setSearchError('Wystąpił błąd podczas wyszukiwania. Spróbuj ponownie.');
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await performSearch(searchInput, 'list');
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            performSearch(searchInput, 'list');
        }
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setSearchInput(value);

        if (searchError) {
            setSearchError('');
        }
    };

    const handleSearchButtonClick = () => {
        performSearch(searchInput, 'list');
    };

    const handleMapButtonClick = () => {
        performSearch(searchInput, 'map');
    };

    return (
        <div role="search" aria-labelledby="search-heading">
            <h2 id="search-heading" className="sr-only">

                Wyszukaj polskie firmy w Irlandii
            </h2>

            {/* Search Form */}
            <form
                id={searchFormId}
                onSubmit={handleSubmit}
                className="relative"
                noValidate
            >
                <div className="relative">
                    <label htmlFor={searchId} className="sr-only">
                        {t('findPolishCompanies')}
                    </label>

                    <div className="relative">
                        <Search
                            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-green-500 dark:text-green-400"
                            aria-hidden="true"
                        />

                        <Input
                            id={searchId}
                            name="search"
                            type="search"
                            value={searchInput}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={isMobile ? t('searchMobile') : t('search')}
                            className={`h-12 w-full truncate rounded-md pl-10 pr-24 ${
                                searchError ? 'border-red-500 focus:ring-red-300' : ''
                            }`}
                            aria-describedby={`${searchHelpId} ${searchError ? searchErrorId : ''}`}
                            aria-invalid={searchError ? 'true' : 'false'}
                            disabled={isSearching}
                            autoComplete="off"
                            spellCheck="false"
                            loupe
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="absolute bottom-1.5 end-2.5 rounded-lg bg-green-500
                        px-4 py-2 text-sm font-medium text-white hover:bg-green-600
                        focus:outline-none focus:ring-4 focus:ring-green-300
                        dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-green-800
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors duration-200 right-1.5"
                        aria-describedby={searchHelpId}
                    >
                        {isSearching ? (
                            <>
                                <span className="sr-only">
                                    {t('searching')}
                                </span>
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                    <span className="hidden sm:inline">Szukam...</span>
                                </div>
                            </>
                        ) : (
                            t('searchButton')
                        )}
                    </button>
                </div>

                {/* Search Help Text */}
                <div id={searchHelpId} className="sr-only">
                    {t('instructions')}
                </div>

                {/* Error Message */}
                {searchError && (
                    <div
                        id={searchErrorId}
                        role="alert"
                        className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center"
                    >
                        <svg
                            className="w-4 h-4 mr-1 flex-shrink-0"
                            aria-hidden="true"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                        {searchError}
                    </div>
                )}
            </form>

            {/* Action Buttons */}
            <div
                className="mt-2 flex flex-row justify-between gap-3 sm:gap-4 md:mt-4"
                role="group"
                aria-labelledby="action-buttons-label"
            >
                <h3 id="action-buttons-label" className="sr-only">
                    {t('quickActions')}
                </h3>

                {/* Map Button */}
                <Button
                    onClick={handleMapButtonClick}
                    disabled={isSearching}
                    variant="exploreMap"
                    size="hero"
                    className="w-full group transition-all duration-200
                    hover:transform hover:scale-[1.02] focus:transform focus:scale-[1.02]
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    aria-describedby="map-button-help"
                >
                    <MapPin
                        className="mr-1 size-5 transition-transform duration-200 group-hover:scale-110"
                        aria-hidden="true"
                    />
                    {t('exploreMap')}
                </Button>
                <div id="map-button-help" className="sr-only">
                    {t('searchInstructions')}
                </div>

                {/* Add Business Button */}
                <Link
                    href="/contact"
                    prefetch
                    className="w-full group"
                    aria-describedby="add-business-help"
                >
                    <Button
                        variant="addBusiness"
                        size="hero"
                        className="w-full transition-all duration-200
                        hover:transform hover:scale-[1.02] focus:transform focus:scale-[1.02]"
                    >
                        <Plus
                            className="mr-1 size-5 transition-transform duration-200 group-hover:scale-110"
                            aria-hidden="true"
                        />
                        {t('addBusiness')}
                    </Button>
                </Link>
                <div id="add-business-help" className="sr-only">
                    {t('goToContact')}
                </div>
            </div>

            {/* Loading Announcement for Screen Readers */}
            {isSearching && (
                <div className="sr-only" aria-live="polite" aria-atomic="true">
                    {t('searchingFor')}
                </div>
            )}
        </div>
    );
};