# Polvia SEO Implementation Plan

## Goal

The goal of this plan is to turn Polvia from a directory with a map/list interface into a directory that is also understandable to Google.

We are **not** changing the product concept.

We are keeping:
- map
- list
- filters
- search

We are adding:
- indexable company profile pages
- indexable city pages
- indexable city + category pages
- basic SEO metadata
- internal linking
- technical SEO foundations

---

## Main Idea

Polvia already has structured data in the form of directory entries.

The SEO task is not to create a separate website.

The SEO task is to expose the same directory data through pages with:
- stable URLs
- clear titles
- headings
- short descriptive content
- internal links
- metadata

This means:
- product view = map + list
- SEO view = structured landing pages based on the same data

---

## Target Page Types

We will build 4 main page types.

### 1. Homepage
URL:
- `/`

Purpose:
- explain what Polvia is
- link to major cities
- link to major categories
- link to map/list
- support broad queries related to Ukrainian businesses in Poland

### 2. City Page
URL examples:
- `/warszawa`
- `/krakow`
- `/wroclaw`

Purpose:
- show all relevant businesses in one city
- target queries like:
  - "ukraińskie firmy warszawa"
  - "ukraińskie usługi warszawa"

### 3. City + Category Page
URL examples:
- `/warszawa/fryzjer`
- `/warszawa/prawnik`
- `/krakow/sklep-ukrainski`

Purpose:
- show a filtered subset of directory entries
- target high-intent local SEO queries like:
  - "ukraiński fryzjer warszawa"
  - "ukraiński prawnik kraków"

### 4. Company Profile Page
URL examples:
- `/firma/kyiv-hair-studio-warszawa`
- `/firma/legal-help-krakow`

Purpose:
- create a dedicated indexable page for each company
- target:
  - branded queries
  - company name + city
  - company name + service

---

## Recommended URL Structure

### Required
- `/`
- `/[city]`
- `/[city]/[category]`
- `/firma/[slug]`

### Optional later
- `/mapa`
- `/dodaj-firme`
- `/o-nas`
- `/kontakt`

### Notes
- URLs must be readable
- slugs must be stable
- avoid exposing random filter combinations as SEO pages
- dynamic filter URLs with many query params should not be the main SEO entry points

---

## Technical Structure in Next.js

Recommended App Router structure:

```txt
app/
  page.tsx

  [city]/
    page.tsx

    [category]/
      page.tsx

  firma/
    [slug]/
      page.tsx

  mapa/
    page.tsx
```

### Meaning of each file

#### `app/page.tsx`
Handles:
- `/`

#### `app/[city]/page.tsx`
Handles:
- `/warszawa`
- `/krakow`

#### `app/[city]/[category]/page.tsx`
Handles:
- `/warszawa/fryzjer`
- `/krakow/prawnik`

#### `app/firma/[slug]/page.tsx`
Handles company profiles:
- `/firma/kyiv-hair-studio-warszawa`

---

## Data Model Requirements

Each company should have at least:

```ts
type Company = {
  id: string;
  name: string;
  slug: string;
  citySlug: string;
  cityName: string;
  categorySlug: string;
  categoryName: string;
  description: string;
  address?: string;
  phone?: string;
  website?: string;
  languages?: string[];
  latitude?: number;
  longitude?: number;
};
```

### Also needed

#### City model
```ts
type City = {
  slug: string;
  name: string;
  seoIntro?: string;
};
```

#### Category model
```ts
type Category = {
  slug: string;
  name: string;
  seoIntro?: string;
};
```

---

## Slug Rules

### Company slug
Format:
- `company-name-city`

Examples:
- `kyiv-hair-studio-warszawa`
- `legal-help-krakow`

### City slug
Examples:
- `warszawa`
- `krakow`
- `wroclaw`

### Category slug
Examples:
- `fryzjer`
- `prawnik`
- `sklep-ukrainski`
- `psycholog`

### Important rules
- use lowercase
- use hyphens instead of spaces
- no Polish special characters in slug if possible
- keep slug stable after creation

---

## SEO Content Strategy

We do **not** need long blog-style articles on every page.

We need short, useful, structured descriptive content.

### Homepage should include
- clear explanation of Polvia
- main value proposition
- key cities
- key categories
- FAQ
- links into the directory

### City page should include
- H1 with city name
- short intro
- list of businesses in the city
- top categories in that city
- internal links to city + category pages
- optional FAQ

### City + category page should include
- H1 with category + city
- short intro
- filtered list of businesses
- link to map view
- FAQ
- internal links to related pages

### Company profile should include
- company name
- category
- city
- address
- phone
- website
- languages
- description
- map/location
- related companies

---

## Metadata Rules

Every important page must have:
- unique `title`
- unique `description`
- canonical URL

### Homepage
Title example:
- `Polvia – ukraińskie firmy i usługi w Polsce`

Description example:
- `Znajdź ukraińskie firmy, sklepy i usługi w Polsce. Przeglądaj katalog, listę firm i mapę.`

### City page
Title example:
- `Ukraińskie firmy w Warszawie | Polvia`

Description example:
- `Znajdź ukraińskie firmy, sklepy i usługi w Warszawie. Sprawdź listę firm, dane kontaktowe i lokalizacje.`

### City + category page
Title example:
- `Ukraiński fryzjer w Warszawie | Polvia`

Description example:
- `Znajdź ukraińskich fryzjerów w Warszawie. Zobacz listę firm, kontakt, lokalizacje i profile.`

### Company profile page
Title example:
- `Kyiv Hair Studio – fryzjer w Warszawie | Polvia`

Description example:
- `Sprawdź profil firmy Kyiv Hair Studio. Zobacz opis, kontakt, adres i lokalizację w Warszawie.`

---

## Internal Linking Strategy

Internal linking is a core part of this implementation.

### Homepage should link to
- key city pages
- key category combinations
- map/list
- add company page

### City page should link to
- all important category pages in that city
- selected company profiles
- global map view

### City + category page should link to
- parent city page
- related category pages in the same city
- relevant company profiles
- map with same filter

### Company profile should link to
- city page
- city + category page
- similar companies

---

## Map Strategy

The map stays as a product feature.

### Important principle
The map is not the only SEO entry point.

### Recommended setup
SEO pages should contain:
- list content
- text content
- link/button to map view

Example:
- SEO page: `/warszawa/fryzjer`
- map view: `/mapa?city=warszawa&category=fryzjer`

This gives us:
- a stable SEO page for Google
- an interactive map experience for users

---

## Indexing Rules

### Should be indexable
- homepage
- city pages
- city + category pages
- company profile pages
- useful static pages like add company / about

### Should generally not be indexable
- random filter combinations
- thin pages with zero businesses
- experimental/test pages
- paginated/filter URLs with low value
- duplicate variants of the same content

### Important rule
Do not create SEO pages for combinations with no content.

If a page has no companies:
- either do not generate it
- or return `notFound()`

---

## Phase-Based Implementation Plan

# Phase 1 — Data Preparation

## Objective
Prepare the data model so that SEO pages can be generated reliably.

## Tasks
- [ ] Make sure every company has a unique `slug`
- [ ] Make sure every company has `citySlug`
- [ ] Make sure every company has `categorySlug`
- [ ] Create a normalized city list
- [ ] Create a normalized category list
- [ ] Add optional `seoIntro` fields for cities and categories
- [ ] Validate that company data is complete enough for profiles

## Deliverables
- stable slugs
- city and category dictionaries
- clean base data for route generation

## Acceptance criteria
- every company has a valid slug
- city and category names are consistent
- there are no broken/missing city/category references

---

# Phase 2 — Company Profile Pages

## Objective
Create indexable pages for individual businesses.

## Route
- `/firma/[slug]`

## Tasks
- [ ] Create `app/firma/[slug]/page.tsx`
- [ ] Implement `getCompanyBySlug(slug)`
- [ ] Show name, category, city, description, address, phone, website, languages
- [ ] Add related companies section
- [ ] Add metadata via `generateMetadata`
- [ ] Add canonical
- [ ] Add links from list/map cards to the company profile

## Page structure
1. H1 with company name
2. Basic business details
3. Description
4. Contact section
5. Map/location
6. Related companies
7. Link back to city/category page

## Acceptance criteria
- every company card can link to a profile page
- profile page renders correctly
- missing slug returns `notFound()`
- metadata is unique per company

---

# Phase 3 — City Pages

## Objective
Create pages for all important cities.

## Route
- `/[city]`

## Tasks
- [ ] Create `app/[city]/page.tsx`
- [ ] Implement `getCityBySlug(slug)`
- [ ] Implement `getCompaniesByCity(citySlug)`
- [ ] Implement `getPopularCategoriesByCity(citySlug)`
- [ ] Add metadata
- [ ] Add internal links to city + category pages

## Page structure
1. H1: "Ukraińskie firmy w [city]"
2. Short intro
3. Top categories in the city
4. Selected companies
5. Link to map
6. Optional FAQ

## Acceptance criteria
- city page exists only for valid cities
- city page shows real companies
- city page links deeper into the directory
- metadata matches the city

---

# Phase 4 — City + Category Pages

## Objective
Build the main SEO landing pages for local service intent.

## Route
- `/[city]/[category]`

## Tasks
- [ ] Create `app/[city]/[category]/page.tsx`
- [ ] Implement `getCategoryBySlug(slug)`
- [ ] Implement `getCompaniesByCityAndCategory(citySlug, categorySlug)`
- [ ] Add metadata
- [ ] Add intro template
- [ ] Add FAQ template
- [ ] Add internal links to related pages
- [ ] Add link/button to map with the same filter

## Page structure
1. H1: "[Category] w [City]"
2. Short intro
3. Filtered list of companies
4. Button: "Zobacz na mapie"
5. FAQ
6. Related links

## Acceptance criteria
- page only exists if city/category combination is valid
- page contains real businesses
- page has unique title and description
- page links to company profiles

---

# Phase 5 — Metadata and Technical SEO

## Objective
Add the minimum technical SEO foundation.

## Tasks
- [ ] Add `generateMetadata` to homepage
- [ ] Add `generateMetadata` to city pages
- [ ] Add `generateMetadata` to city + category pages
- [ ] Add `generateMetadata` to company profiles
- [ ] Add canonical URLs
- [ ] Create sitemap generation
- [ ] Review robots.txt
- [ ] Make sure thin/duplicate pages are not indexable

## Acceptance criteria
- all major pages have metadata
- sitemap includes only indexable canonical URLs
- robots.txt does not block important pages

---

# Phase 6 — Internal Linking Cleanup

## Objective
Make the site crawlable and understandable as a structured directory.

## Tasks
- [ ] Link homepage -> city pages
- [ ] Link homepage -> top city + category pages
- [ ] Link city pages -> city + category pages
- [ ] Link city + category pages -> company profiles
- [ ] Link company profiles -> city pages
- [ ] Link company profiles -> related companies
- [ ] Link SEO pages -> map

## Acceptance criteria
- a user and crawler can navigate deeper without relying on filters alone
- company profiles are not isolated
- important pages are reachable by internal links

---

# Phase 7 — Structured Data (Later, but Recommended)

## Objective
Add schema markup after the page architecture is working.

## Recommended types
- `Organization`
- `WebSite`
- `BreadcrumbList`
- `FAQPage`
- `LocalBusiness` on company pages

## Tasks
- [ ] Add Organization schema to homepage
- [ ] Add BreadcrumbList to city, category and company pages
- [ ] Add FAQPage only where visible FAQ exists
- [ ] Add LocalBusiness schema to company profile pages

## Acceptance criteria
- schema reflects visible content
- no fake or misleading structured data
- pages validate in schema testing tools

---

## Recommended Implementation Order

Do not build everything at once.

### Step 1
Build company profile pages first.

Why:
- easiest conceptually
- every company naturally deserves its own page
- improves internal structure immediately

### Step 2
Build city pages.

Why:
- simpler than city + category pages
- helps establish location structure

### Step 3
Build city + category pages.

Why:
- strongest SEO growth opportunity
- depends on clean city/category structure

### Step 4
Add technical SEO cleanup.

### Step 5
Add structured data.

---

## Suggested Milestone Plan

### Milestone 1
Data cleanup
- slugs
- city/category normalization

### Milestone 2
Company profiles live
- `/firma/[slug]`

### Milestone 3
City pages live
- `/[city]`

### Milestone 4
City + category pages live
- `/[city]/[category]`

### Milestone 5
Metadata + sitemap + robots

### Milestone 6
Schema + refinements

---

## Example Query Helpers

Suggested backend/data helper functions:

```ts
getCompanyBySlug(slug: string)
getCompaniesByCity(citySlug: string)
getCompaniesByCityAndCategory(citySlug: string, categorySlug: string)
getCityBySlug(citySlug: string)
getCategoryBySlug(categorySlug: string)
getPopularCategoriesByCity(citySlug: string)
getRelatedCompanies(companyId: string, citySlug: string, categorySlug: string)
```

---

## Minimal Version to Launch First

If implementation feels too big, launch the smallest useful version first.

### Minimum viable SEO release
- [ ] company profile pages
- [ ] city pages
- [ ] metadata for homepage, city pages and company profiles
- [ ] internal linking from directory cards to profiles

### Second release
- [ ] city + category pages
- [ ] FAQ blocks
- [ ] map linking
- [ ] sitemap

### Third release
- [ ] schema
- [ ] multilingual SEO
- [ ] more advanced templates

---

## Things We Must Avoid

- generating thousands of empty SEO pages
- indexing random filtered URLs
- creating pages with no unique value
- relying only on JavaScript filters for discoverability
- making all pages nearly identical
- exposing pages with zero results as SEO landing pages

---

## Definition of Done

This SEO implementation is considered successful when:

- company profile pages exist and are linked
- city pages exist and show real directory content
- city + category pages exist for valid combinations
- major pages have unique metadata
- internal linking is in place
- map remains a product view, not the only content view
- Google can understand the directory structure without relying on UI filters

---

## Future Extensions

Not required for the first implementation, but useful later:
- multilingual route structure
- hreflang
- editorial city/category intros
- blog/help content supporting category pages
- user reviews
- category landing pages without city
- “similar companies” improvements
- dynamic breadcrumbs
- featured businesses

---

## Personal Note for Implementation

If the architecture starts feeling confusing, remember this:

We are not building a second website.

We are taking one dataset and exposing it through multiple useful page types:

- homepage = what is Polvia
- city page = businesses in one city
- city + category page = businesses in one category within one city
- company page = one business
- map = interactive exploration

That is the entire conceptual model.
