'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export const CookieModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const t = useTranslations('Cookies');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
                <div className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold">{t('modalTitle')}</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                 xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                      d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <section>
                            <h3 className="mb-2 text-lg font-medium">{t('necessaryCookiesTitle')}</h3>
                            <p>{t('necessaryCookiesDescription')}</p>
                        </section>

                        <section>
                            <h3 className="mb-2 text-lg font-medium">{t('analyticsCookiesTitle')}</h3>
                            <p>{t('analyticsCookiesDescription')}</p>
                        </section>

                        <section>
                            <h3 className="mb-2 text-lg font-medium">{t('marketingCookiesTitle')}</h3>
                            <p>{t('marketingCookiesDescription')}</p>
                        </section>

                        <section>
                            <h3 className="mb-2 text-lg font-medium">{t('preferenceCookiesTitle')}</h3>
                            <p>{t('preferenceCookiesDescription')}</p>
                        </section>

                        <section>
                            <h3 className="mb-2 text-lg font-medium">{t('howToManageTitle')}</h3>
                            <p>{t('howToManageDescription')}</p>
                        </section>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="rounded bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                        >
                            {t('closeModal')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
