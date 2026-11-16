# Implementation plan

| # | Milestone | Scope | Status |
|---|---|---|---|
| 1 | Foundation | Vite + React + TS + Tailwind, base path `/mixivivu-clone/`, port 5288 | Done |
| 2 | Survey and data | Route inventory, reference screenshots, public API capture, normalized `public/data`, static assets | Done |
| 3 | Design system | Tokens from source CSS, typography scale, Button/Badge/Card/Input/Dropdown/Modal/Tabs/Pagination/Accordion | Done |
| 4 | Layout | Sticky header with active state, mobile menu, footer | Done |
| 5 | Landing pages | Ship home, hotel home, flight home, business page | Done |
| 6 | Listings | Ship and hotel search with URL state, filters, sort, pagination, empty/error states | Done |
| 7 | Details | Ship and hotel detail: gallery, anchor tabs, rooms and total, room modal, booking/rent modals, reviews | Done |
| 8 | Content pages | Blog list/detail, about, contact, FAQ ×2, legal ×6, 404 | Done |
| 9 | Flight | Search form with airport picker and validation; result page without live fares | Done (no fare backend) |
| 10 | QA | Playwright functional suite, desktop/tablet/mobile visual comparison against source | Done, see progress.md |

## Out of scope

- `/admin/**` (authenticated staff area).
- Live flight fares (`/tim-ve-may-bay/ket-qua` data comes from a paid provider).
- Real backend persistence for bookings, contact requests and reviews.
