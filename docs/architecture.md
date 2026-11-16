# Architecture

## Stack

- React 18 + TypeScript, built with Vite 5.
- React Router 6 (`createBrowserRouter`, lazy route chunks).
- Tailwind CSS 3; every color, radius, shadow, z-index and size maps to a CSS
  custom property in `src/styles/tokens.css` (values copied from the source CSS).
- Playwright for end-to-end and responsive regression tests.

## Base path and port

The app is served under **`/mixivivu-clone/`** on port **5288** (preview: 5289),
so it never collides with other local projects that use Vite's defaults
(`/`, 5173). Both values live in `app.config.ts` and are shared by Vite,
React Router (`basename`) and Playwright. To deploy under another path, change
`APP_BASE_PATH` only.

## Folder layout

```
app.config.ts            base path + dev port
scripts/build-data.py    raw API capture -> public/data (mock API)
public/
  assets/                logos, partner logos, backgrounds, illustrations
  data/                  JSON "API": ships, hotels, blogs, taxonomies, pages
src/
  app/                   App + router
  config/site.ts         contact info, CDN base, nav + footer links
  constants/routes.ts    every route path in one place
  types/models.ts        domain types (Ship, Hotel, Blog, Room, Review…)
  services/              http (cached fetch), catalogService, formService
  hooks/                 useAsync, useFormState, useClickOutside, useDocumentTitle
  utils/                 formatting, asset URLs, HTML sanitizer, cx
  data/                  static copy: testimonials, page text, option lists
  styles/                tokens.css + global.css (typography scale)
  components/
    common/              Button, Badge, Card, Icon, Modal, Tabs, Pagination,
                         Accordion, Stepper, RatingBadge, RichText, SectionHeader
    forms/               TextField/TextArea, Dropdown, Checkbox
    feedback/            Loading, EmptyState, ErrorState
    layout/              Header (desktop nav + mobile menu), Footer
  layouts/MainLayout.tsx
  features/
    catalog/             query model, ProductCard, SearchBox, FilterSidebar,
                         CatalogListing, mappers, lookup hooks
    detail/              ProductDetailView (shared by ships and hotels),
                         Gallery, SectionNav, RoomPicker, RoomModal,
                         BookingModal, Reviews, InfoCard
    home/                VideoHero, Testimonials, PartnerLogos, CategoryCard
    blog/                BlogCard
    flight/              FlightSearchForm, airport list
  pages/                 one file per route (thin: data loading + composition)
tests/app.spec.ts        Playwright suite
```

## Data flow

1. `scripts/build-data.py` normalizes the captured public API responses into
   small JSON files: an index per collection (`ships.json`, `hotels.json`,
   `blogs.json`) plus one detail file per item (`ships/<slug>.json`, …).
   Reviewer phone numbers and e-mails are dropped.
2. `services/http.ts` fetches those files relative to the base path and caches
   each request for the session. A missing file raises `NotFoundError`, which
   pages turn into the 404 view.
3. Pages call `catalogService` through `useAsync`, which exposes
   `data / error / loading / reload` so every page renders loading, error and
   empty states consistently.

Product images and the hero videos are not committed; `utils/assets.ts`
resolves CDN-relative keys against `SITE.cdnBase`.

## Search and filtering

`features/catalog/query.ts` defines `CatalogQuery` and keeps it in the URL with
the same parameter names as the source (`title`, `category` / `city`,
`greater_defaultPrice`, `lower_defaultPrice`) plus `star`, `feature`, `sort`,
`page`, `size`. Listing state is fully shareable and survives reloads.
`applyCatalogQuery` filters and sorts in memory; ships match stars on the
integer part of their review score (the source behaviour), hotels on their
star standard.

## Forms

There is no backend. Booking, consultation, contact and review submissions go
through `services/formService.ts`, which validates on the client, stores the
entry in `localStorage` and resolves after a short delay. New reviews appear
immediately on the page (name, score, comment and date only).

## Shared detail view

Ship and hotel detail pages differ only in configuration (price unit, info rows,
rules/FAQ links, amenity source, rent-whole-ship button). Both render
`features/detail/components/ProductDetailView.tsx`.

## Security notes

CMS HTML (blog bodies, legal pages, FAQ answers) comes from a third party, so
`utils/sanitizeHtml.ts` whitelists formatting tags and safe attributes before
it is injected.
