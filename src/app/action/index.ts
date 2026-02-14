// app/actions/newsletter.ts
'use server';

import { z } from 'zod';
import { addEmailToNewsletter } from '@/lib/queries';
// import { addToDatabase } from '@/lib/database-service';
// import { addToConvertKit } from '@/lib/convertkit-service';

const schema = z.object({
    email: z.string().email('Invalid email address'),
});

export type NewsletterState = {
    message: string;
    success: boolean;
};

export async function subscribeNewsletter(
    prevState: NewsletterState | null,
    formData: FormData
): Promise<NewsletterState> {
    try {
        // Validate with Zod
        const validated = schema.safeParse({
            email: formData.get('email'),
        });

        if (!validated.success) {
            return {
                success: false,
                message: validated.error.errors[0].message,
            };
        }

        // Save to database
        const dbResult = await addEmailToNewsletter(validated.data.email);

        // If database save failed
        if (!dbResult.success) {
            return dbResult;
        }

        // Add to ConvertKit (when ready)
        // const ckResult = await addToConvertKit(validated.data.email);
        // if (!ckResult.success) return ckResult;

        return {
            success: true,
            message: 'Thank you for subscribing!',
        };

    } catch (error) {
        console.error('Subscription error:', error);
        return {
            success: false,
            message: 'An unexpected error occurred. Please try again.',
        };
    }
}