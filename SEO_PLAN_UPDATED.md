# SEO_PLAN.md

# Polvia SEO Plan — Updated for Current Architecture

## Purpose of this document

This file is the updated SEO implementation plan for Polvia.

It replaces the earlier generic version and is akdjusted to the real project state:

- Next.js 15 App Router
- `next-intl`
- 4 locales: `pl`, `en`, `ru`, `uk`
- Drizzle ORM + Supabase
- current map-centric routing
- existing dynamic sitemap and robots
- service-based data model with `service_locations`
- location-level slugs already present
- category slugs already mapped per locale
- 7 major city slugs already defined

This plan is intentionally practical and implementation-oriented.

---

# 1. Main decision

## Chosen SEO route structure

We will use:

- `/firma/[slug]`
- `/miasto/[city]`
- `/miasto/[city]/[category]`

### Meaning

- `/firma/[slug]` = profile page for one **service location**
- `/miasto/[city]` = city landing page
- `/miasto/[city]/[category]` = city + category landing page

### Example URLs

Polish:
- `/firma/kyiv-hair-studio-warszawa`
- `/miasto/warszawa`
- `/miasto/warszawa/fryzjer`

Localized variants later:
- `/en/city/warsaw/hairdresser` or equivalent localized route strategy
- `/uk/misto/varshava/perukar` or equivalent localized route strategy

Exact non-Polish path naming can be decided later. For the MVP, Polish-first rollout is recommended.

---

# 2. Why we are NOT using root /[city]

We are not using:
- `/<city>`
- `/<city>/<category>`

## Reason

The root segment is already semantically important because of internationalization.

Current setup already uses locale-aware routing with `next-intl`, including prefixed locale paths such as:
- `/en/...`
- `/ru/...`
- `/uk/...`

Polish is the default locale without a prefix.

Because of that, a root-level `[city]` segment would create ambiguity and route complexity.

### Problems with root `/[city]`
- conflicts with i18n assumptions
- requires middleware exceptions or allowlists
- increases maintenance cost
- makes onboarding harder
- becomes fragile when adding more routes later

## Decision

We prefer the `/miasto/` prefix because it is:
- explicit
- easy to reason about
- compatible with `next-intl`
- safer to maintain
- good enough for SEO

---

# 3. Updated conceptual model

The previous version used the simplified idea of “company pages”.

That is not fully correct for the current data model.

## Real data model

The project is not:
- one company = one page

The project is closer to:
- one service
- many service locations
- one SEO profile page per service location

## Correct page meaning

### `/firma/[slug]`
This page should represent:
- one `service_location`
- not one global company or abstract service entity

This is actually better for SEO because location-specific pages are more precise.

### Example
If one business has locations in multiple cities, then each location can have its own page.

This means:
- better local relevance
- stronger geographic specificity
- more useful user experience
- cleaner page intent

---

# 4. Product vs SEO layer

Polvia remains:
- a map-centric directory
- a searchable list
- a filter-based browsing product

We are **not** replacing that product.

We are adding a structured SEO layer on top of the same data.

## Product layer
Examples:
- map view
- list view
- filters
- search flow

## SEO layer
Examples:
- `/firma/[slug]`
- `/miasto/[city]`
- `/miasto/[city]/[category]`

These pages should:
- expose stable URLs
- have readable titles
- contain descriptive headings
- be internally linked
- lead users into the map/list experience

---

# 5. SEO rollout strategy

## Recommended rollout

### Phase 1
Polish-only SEO pages

### Phase 2
Extend to remaining locales:
- English
- Ukrainian
- Russian

## Why Polish-first

Because:
- Polish is default locale
- Polish is primary market
- faster implementation
- lower complexity
- easier debugging
- better for validating architecture before multiplying page surface by 4

## Important note

Even if the first launch is Polish-only in scope, the implementation must be designed in a way that does not block future locale expansion.

That means:
- do not hardcode assumptions that break multi-locale rollout later
- keep city/category slug logic compatible with translations
- prepare metadata generation to become locale-aware later

---

# 6. Current project strengths we can reuse

The current project already has several strong SEO foundations.

## Already available
- Next.js App Router
- next-intl
- dynamic sitemap
- robots.txt
- metadata on key pages
- service location slugs
- category enum
- locale-based category slug mappings
- 7 major city slugs already defined

## Meaning

We are not starting from zero.

The SEO plan should extend what already exists instead of rebuilding everything.

---

# 7. Main data model gaps that must be solved first

Before building city SEO pages, the data model needs normalization work.

## Gap 1 — Cities are not normalized enough

Current issue:
- `service_locations.city` is free-text

This means we cannot reliably build city SEO pages directly from raw values.

### Required fix
Create a city normalization layer.

Possible approach:
- a city dictionary table or config
- mapping raw city values -> normalized city slug
- mapping city slug -> display name per locale

### Example idea
Raw values:
- `Warszawa`
- `warszawa`
- `Warsaw`
- `Warszawa, Mazowieckie`

Should eventually resolve to one normalized city entity, for example:
- slug: `warszawa`
- Polish label: `Warszawa`
- English label: `Warsaw`
- Ukrainian label: localized name
- Russian label: localized name

## Gap 2 — Category slugs are locale-aware, not universal

Current issue:
- category exists as enum
- slug mappings differ by locale

This is okay, but it means city+category pages cannot assume one universal category slug across all languages.

### Required fix
Treat category identity as:
- stable enum internally
- locale-dependent slug externally

That means:
- internal routing/data lookup can use enum identity
- displayed URL segment must use locale-specific slug mapping

## Gap 3 — Profile page identity is location-based

Current issue:
- slugs exist on `service_locations`
- not on an abstract “company” entity

### Required decision
Use location profile pages as the canonical SEO profile concept.

This is the correct decision for the current project architecture.

---

# 8. Final target page types

## 8.1 Location profile page

### Route
- `/firma/[slug]`

### Data source
- `service_locations`

### Purpose
- create one indexable page per location
- capture local brand/service intent
- provide a direct, stable landing page for Google

### What should be on the page
- business / service name
- location city
- category/categories
- description
- address
- contact data
- service information
- map preview or map CTA
- related locations/services
- internal links back to city pages and city+category pages

---

## 8.2 City page

### Route
- `/miasto/[city]`

### Purpose
- create one page for all important service locations in a city
- target general city-level search intent

### Example intent
- Ukrainian businesses in Warsaw
- services for Ukrainians in Krakow
- Ukrainian-speaking professionals in Wroclaw

### What should be on the page
- H1
- short intro
- list of relevant locations
- top categories in the city
- internal links to city+category pages
- CTA into map view
- optional FAQ

---

## 8.3 City + category page

### Route
- `/miasto/[city]/[category]`

### Purpose
- create high-intent local landing pages
- target specific service intent by city

### Example intent
- Ukrainian hairdresser in Warsaw
- Ukrainian lawyer in Krakow
- Ukrainian accountant in Wroclaw

### What should be on the page
- H1
- short intro
- filtered list of service locations
- internal links to profiles
- related category links
- city page link
- CTA into map view
- FAQ section

---

# 9. Technical routing recommendation

## Recommended route structure in App Router

This is the conceptual structure. Actual file paths may depend on the project’s locale routing conventions.

```txt
app/
  [locale]/
    ...
  firma/
    [slug]/
      page.tsx
  miasto/
    [city]/
      page.tsx
      [category]/
        page.tsx
```

Or, if the project already nests locale-aware routes differently, the same logical structure should still be preserved.

## Important routing principle

Do not create a root-level dynamic `[city]` segment.

Keep city SEO routes behind a stable prefix:
- `/miasto/...`

---

# 10. Relationship to current map routes

Current product already uses map-centric routing such as:
- `/mapa/{category}/{county}`

The new SEO pages should not replace this.

They should complement it.

## Recommended interaction model

### SEO page
- `/miasto/warszawa/fryzjer`

### Product map destination
- current map route for the same filtered view

Example:
- user lands on SEO page from Google
- user reads page and sees relevant service locations
- user clicks “See on map”
- user continues into the current interactive map experience

## Important principle

SEO pages are entry points.
Map pages are exploration tools.

Both should coexist.

---

# 11. Metadata strategy

## MVP scope
Metadata should be fully implemented for Polish first.

## Required on all SEO pages
- unique title
- unique description
- canonical URL
- Open Graph basics if already part of current architecture

## Later
For additional locales, metadata must become locale-aware:
- translated titles
- translated descriptions
- correct alternates / hreflang
- correct canonical per locale route

---

# 12. Internationalization strategy

The previous generic SEO plan did not account enough for i18n.

This updated plan does.

## Rules

### For Polish MVP
- launch Polish SEO pages first
- use Polish city/category labels and slugs
- keep architecture ready for multi-locale expansion

### For later locale rollout
Each SEO page must support:
- translated title
- translated description
- locale-aware category slug
- locale-aware city label
- hreflang alternates
- consistent internal linking

## Important nuance

Category slugs already differ by locale, which is good.

City labels should also be locale-aware, but city identity should remain normalized internally.

That means:
- one internal city identity
- multiple locale-specific labels
- possibly locale-specific URL segments later if desired

---

# 13. Canonical and hreflang direction

## Polish MVP
If only Polish SEO pages are launched first, then:
- canonical points to Polish version
- no fake alternates should be emitted for pages that do not exist yet

## Later multi-locale rollout
When localized SEO pages exist, each should have:
- self-referencing canonical
- correct alternates
- correct hreflang relationships

Do not emit hreflang clusters for pages that are not truly implemented.

---

# 14. Indexing rules

## Should be indexable
- `/firma/[slug]`
- `/miasto/[city]`
- `/miasto/[city]/[category]`
- core static pages already intended for indexing

## Should generally NOT be indexable
- arbitrary filter URLs
- empty city pages
- empty city+category pages
- test routes
- thin duplicates
- random parameter combinations

## Important rule
If a city or city+category page has no meaningful content, it should not exist as an SEO landing page.

Use:
- no generation
or
- `notFound()`

Do not create empty SEO surfaces.

---

# 15. Internal linking strategy

Internal linking remains essential.

## Homepage should link to
- top city pages
- top city+category pages
- key profile pages if helpful
- current map/list entry points

## City pages should link to
- city+category pages
- location profile pages
- map entry points

## City+category pages should link to
- parent city page
- relevant profile pages
- related city+category pages
- filtered map route

## Profile pages should link to
- parent city page
- relevant city+category page(s)
- related profiles/locations
- map view if useful

---

# 16. Structured data direction

Structured data should be added after the architecture is working.

## Recommended types
- `Organization`
- `WebSite`
- `BreadcrumbList`
- `FAQPage` where FAQ exists visibly
- `LocalBusiness` or best matching business type for location profiles

## Important note
Structured data must reflect visible page content.

---

# 17. Updated implementation phases

# Phase 1 — City normalization

## Goal
Create a reliable city identity system for SEO pages.

## Tasks
- [ ] define a normalized city dictionary
- [ ] map raw `service_locations.city` values to normalized city slugs
- [ ] define display names per locale
- [ ] validate the first 7 major cities
- [ ] decide fallback behavior for unmapped city values

## Deliverable
A clean city layer that can power `/miasto/[city]`

---

# Phase 2 — Polish location profile pages

## Goal
Launch the easiest and most valuable SEO pages first.

## Route
- `/firma/[slug]`

## Tasks
- [ ] build route for location profiles
- [ ] resolve content from `service_locations.slug`
- [ ] render core location details
- [ ] add metadata
- [ ] add canonical
- [ ] link from current cards/listings/maps where relevant

## Deliverable
One indexable page per valid location slug

---

# Phase 3 — Polish city pages

## Goal
Launch city landing pages for major normalized cities.

## Route
- `/miasto/[city]`

## Tasks
- [ ] build city route
- [ ] fetch locations by normalized city slug
- [ ] show top categories in that city
- [ ] show relevant location listings
- [ ] add metadata
- [ ] link into map experience
- [ ] return `notFound()` for invalid city slugs

## Deliverable
Working city pages for target cities

---

# Phase 4 — Polish city + category pages

## Goal
Launch high-intent local SEO pages.

## Route
- `/miasto/[city]/[category]`

## Tasks
- [ ] build route
- [ ] resolve city from normalized slug
- [ ] resolve category from enum + locale slug mapping
- [ ] fetch matching location listings
- [ ] add intro
- [ ] add metadata
- [ ] add links to profile pages
- [ ] add map CTA
- [ ] return `notFound()` where appropriate

## Deliverable
Working city+category SEO landing pages

---

# Phase 5 — Technical SEO extension

## Goal
Extend existing SEO infrastructure for the new pages.

## Tasks
- [ ] include new routes in dynamic sitemap
- [ ] ensure robots rules allow intended crawling
- [ ] verify canonicals
- [ ] prevent indexing of thin/empty pages
- [ ] ensure metadata coverage on all new page types

## Deliverable
New SEO pages are technically discoverable and indexable

---

# Phase 6 — Internal linking cleanup

## Goal
Connect the new SEO layer to the product layer.

## Tasks
- [ ] add homepage links to city pages
- [ ] add city links to city+category pages
- [ ] add profile links from listings/cards
- [ ] add map CTAs from SEO pages
- [ ] add reverse links from profiles to city/city+category pages

## Deliverable
Google and users can move through the directory structure without relying only on JS filters

---

# Phase 7 — Locale expansion

## Goal
Extend the successful Polish SEO model to the remaining locales.

## Tasks
- [ ] localize metadata
- [ ] localize page copy
- [ ] implement hreflang correctly
- [ ] localize category URL segments
- [ ] finalize city labels / route strategy for other locales
- [ ] update sitemap/alternates accordingly

## Deliverable
Multi-locale SEO page system built on the validated Polish structure

---

# 18. Definition of done

This implementation is successful when:

- `/firma/[slug]` works for valid service locations
- `/miasto/[city]` works for normalized target cities
- `/miasto/[city]/[category]` works for valid city/category combinations
- all new SEO pages have meaningful content
- metadata is present and correct
- sitemap includes the correct pages
- map-centric product flow remains intact
- the architecture is compatible with later locale rollout

---

# 19. Short final recommendation

## Recommended decision
Use:
- `/firma/[slug]`
- `/miasto/[city]`
- `/miasto/[city]/[category]`

## Do NOT use
- `/<city>`
- `/<city>/<category>`

## MVP order
1. city normalization
2. Polish `/firma/[slug]`
3. Polish `/miasto/[city]`
4. Polish `/miasto/[city]/[category]`
5. technical SEO extension
6. locale expansion

This is the lowest-risk path with the highest practical SEO value for the current architecture.
