// lib/newsletter.ts - Shared newsletter logic
import { z } from 'zod';

export interface NewsletterFormData {
    email: string;
}

export interface NewsletterState {
    success: boolean;
    message: string;
}

// Unified validation schema
export const createNewsletterSchema = (t: (key: string) => string) =>
    z.object({
        email: z
            .string()
            .min(1, { message: t('emailRequired') })
            .email({ message: t('enterValidEmailAddress') })
            .max(100, { message: t('tooLong') }),
    });

export const handleNewsletterSuccess = (callback: () => void, delay: number = 5000) => {
    setTimeout(callback, delay);
};

export const submitNewsletterForm = async (
    formData: NewsletterFormData,
): Promise<NewsletterState> => {
    try {
        const res = await fetch('/api/subscribe-newsletter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        const result = await res.json();

        // Check if the request was successful
        if (!res.ok) {
            // Handle different error status codes
            switch (res.status) {
                case 429: {
                    // Rate limited - show specific message with retry time
                    const retryMinutes = result.retryAfter ? Math.ceil(result.retryAfter / 60) : 60;
                    const timeMessage =
                        retryMinutes > 60
                            ? `${Math.ceil(retryMinutes / 60)} hour(s)`
                            : `${retryMinutes} minute(s)`;

                    return {
                        success: false,
                        message: `${result.message || 'Too many requests.'} Try again in ${timeMessage}.`,
                    };
                }
                case 400: {
                    // Bad request (invalid email, etc.)
                    return {
                        success: false,
                        message: result.error || result.message || 'Invalid email address.',
                    };
                }
                case 500: {
                    // Server error
                    return {
                        success: false,
                        message:
                            result.error || result.message || 'Server error. Please try again.',
                    };
                }
                default: {
                    // Other error status codes
                    return {
                        success: false,
                        message:
                            result.message ||
                            result.error ||
                            'Something went wrong. Please try again.',
                    };
                }
            }
        }

        // Success case - mark as subscribed in localStorage
        if (result.success) {
            localStorage.setItem('hasSubscribedNewsletter', 'true');
            localStorage.setItem('hasSeenNewsletterPopup', 'true');
        }

        return result;
    } catch (error) {
        console.error('Newsletter submission error:', error);
        return {
            success: false,
            message: 'Network error. Please check your connection and try again.',
        };
    }
};
