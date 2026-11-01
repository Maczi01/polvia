import type { z } from 'zod';

/** Issue Zoda jako `sciezka.pola: komunikat` — format bledow walidacji w skryptach CLI i seedzie. */
export function formatZodIssue(issue: z.ZodIssue): string {
    return `${issue.path.join('.') || '(korzen)'}: ${issue.message}`;
}
