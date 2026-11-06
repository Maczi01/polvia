/**
 * Status zgloszenia firmy w panelu — wartosci enuma `submission_status`.
 * Kolejnosc jest kolejnoscia w bazie, NIE zmieniaj jej.
 *
 * Modul bez importow, zeby komponent kliencki panelu nie wciagal drizzle `pg-core`.
 */
export const SUBMISSION_STATUSES = ['new', 'added', 'rejected'] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
