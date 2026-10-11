import type { BusinessDraft, DraftFacts, LanguageCode } from '@/lib/add-business/draft-schema';
import type { DraftGeo } from '@/lib/add-business/draft-store';
import type { BusinessPreview, DraftPin } from '@/lib/add-business/types';

/**
 * Dane karty podgladu (R5) ze szkicu albo ze szkicu po edycji wlasciciela. Kategoria,
 * zasieg, tagi i opisy zawsze pochodza ze szkicu (R9).
 */

export function toPin(geo: DraftGeo | null): DraftPin | null {
    if (geo === null) return null;
    return { lat: geo.lat, lng: geo.lng, approximate: geo.approximate };
}

interface PreviewInput {
    draft: BusinessDraft;
    facts: DraftFacts;
    webpage: string | null;
    languages: LanguageCode[];
}

export function buildPreview({ draft, facts, webpage, languages }: PreviewInput): BusinessPreview {
    return {
        name: facts.name,
        category: draft.category,
        coverage: draft.coverage,
        languages,
        tags: draft.tags,
        descriptions: draft.descriptions,
        street: facts.street,
        postcode: facts.postcode,
        city: facts.city,
        phoneNumber: facts.phoneNumber,
        email: facts.email,
        webpage,
        openingHours: facts.openingHours,
    };
}
