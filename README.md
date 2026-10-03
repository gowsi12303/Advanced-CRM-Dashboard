# Relay CRM

A customer relationship dashboard built with Next.js, TypeScript and TanStack Query. It has an overview dashboard, a filterable customer table, a drag-and-drop pipeline board, full customer record management, and a mock REST API that the UI talks to over real HTTP.

"Relay CRM" is a placeholder product name.

## Features

**Dashboard**
- Key figures calculated from the customer data: total customers, active leads, contacted this week, and customers needing follow-up
- A breakdown of customers by status and the five most recently added customers
- Every figure links to the Customers page with the matching filter applied
- A header search that opens the Customers page with the term applied

**Customers table**
- Search across name, email, phone and company, debounced by 300 ms
- Server-side sorting from the column headers, with the direction shown
- Pagination with 10, 25 or 50 rows per page
- Columns that drop out as the table narrows, with the hidden details shown under the customer's name

**Filters**
- Status, company (multi-select), date range on created or last-contact date, partial email, partial phone
- Edits stay in a draft until **Apply**; **Clear** resets them; a badge shows how many filters are active
- An option to include never-contacted customers in a last-contact range
- Saved filters (save, load, rename, delete) and three built-in templates
- Applied filters shown as removable chips

**Customer records**
- Details drawer organised into contact information, company and status, timeline, and notes
- Add and edit with inline validation; delete with confirmation
- Log a contact (method, date and time, optional note), which updates the last-contact details
- Notes: add, and delete with confirmation

**Pipeline board**
- One column per status; drag a card between columns to change status, or within a column to reorder
- Optimistic updates with rollback and an error message if the save fails
- Keyboard dragging with screen-reader announcements, plus a "Move to" menu on each card
- Uses the same search and filters as the table

**Bulk actions and export**
- Select rows on the current page; change status or delete in bulk
- Export the whole filtered result (not just the current page) as CSV

**General**
- State in the URL: search, filters, sort, page, page size and the open customer drawer. Links are shareable, and reload and back/forward work
- Search and filters carry over when switching between the table and the board
- A dark theme by default, with light and system themes available from the header
- Keyboard shortcuts: `/` focuses search on every page; `N` opens Add customer on the Customers and Pipeline pages
- Responsive from phone to wide desktop
- Loading, empty and error states with Retry throughout; toast notifications for every action

## Accessibility

- Every control has an accessible name, including icon-only buttons, row checkboxes and drag handles.
- Everything works from the keyboard: a "Skip to content" link, menus, dialogs, table sorting, selection, and dragging cards on the pipeline (Space or Enter to pick up, arrow keys to move, Space or Enter to drop, Escape to cancel).
- Dialogs and sheets trap focus, close with Escape, and return focus to the control that opened them.
- Sortable headers expose `aria-sort`; the select-all checkbox reports a mixed state; result counts and selection counts are polite live regions; load failures use `role="alert"`.
- Pipeline drags are announced with the customer's name, the column and the position.
- Text contrast is at least 4.5:1 in both themes on the surfaces that were measured (pages, dialogs, menus, empty and error states).

This has been checked with automated tests and scripted browser runs, not with a screen reader or a formal audit.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix primitives) |
| Server state | TanStack Query v5 |
| Forms and validation | react-hook-form, zod |
| Drag and drop | dnd-kit |
| Toasts, themes | sonner, next-themes |
| Tests | Vitest, Testing Library, jsdom |

## Getting started

Requires Node.js 20.9 or later (developed on Node 24).

```bash
npm install
npm run dev
```

Open http://localhost:3000. The root path redirects to `/dashboard`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate Next.js route types, then run `tsc --noEmit` |

Run `npm run typecheck` (or start the dev server) once after cloning. Next.js generates the global `LayoutProps` and `RouteContext` types, and editors report them as missing until that has happened.

## Routes

| Route | Purpose |
|---|---|
| `/dashboard` | Overview: key figures, status breakdown, recent customers |
| `/customers` | Customer table |
| `/pipeline` | Pipeline board |
| `/` | Redirects to `/dashboard` |

### API

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/customers` | GET, POST | List (search, filter, sort, paginate) and create |
| `/api/customers/[id]` | GET, PATCH, DELETE | Read, update, delete |
| `/api/customers/[id]/contact` | POST | Log a contact |
| `/api/customers/[id]/notes` | GET, POST | List and add notes |
| `/api/customers/[id]/notes/[noteId]` | DELETE | Delete a note |
| `/api/customers/[id]/move` | POST | Set pipeline status and position |
| `/api/customers/bulk` | POST | Bulk delete or status change |
| `/api/companies` | GET | Distinct company names |
| `/api/saved-filters` | GET, POST | List and create saved filters |
| `/api/saved-filters/[id]` | PATCH, DELETE | Rename or delete a saved filter |

Errors share one JSON shape: `{ "error": { "code", "message", "fieldErrors?" } }`.

## Architecture

```
src/
  app/
    (dashboard)/          Layout shell, /dashboard, /customers and /pipeline pages
    api/                  Route handlers (the mock backend's HTTP surface)
    providers.tsx         Theme, TanStack Query and toast providers
  components/
    ui/                   shadcn/ui components
    layout/               Sidebar, header, header search, theme toggle
    shared/               Generic pieces: search input, pagination, confirm dialog, states
  features/customers/
    types.ts              Domain types and constants
    api/                  Typed API client (the only place that knows URLs)
    hooks/                Query keys, query and mutation hooks, URL state
    lib/                  Pure logic: schemas, URL serialisation, filters, pipeline, CSV
    components/           Dashboard, table, filters, CRUD dialogs, pipeline board
  server/                 Repository interface, in-memory implementation, query engine, seed data
  hooks/                  Hooks used by shadcn/ui components
  lib/                    Cross-cutting helpers: fetch wrapper, formatting, hotkeys, CSV
  test/                   Test setup and helpers
```

How a request flows:

1. A component calls a hook such as `useCustomers(params)`.
2. The hook calls the typed client in `features/customers/api`.
3. The client sends a real HTTP request to a route handler in `app/api`.
4. The route handler validates input with zod and calls the `CustomerRepository` interface.
5. The in-memory implementation in `server/` answers it.

Components never build URLs or call `fetch` themselves, and route handlers never touch the store directly.

## Data and the mock backend

There is no database. The route handlers are backed by an in-memory store that is seeded with 150 customers when the server starts.

- **Data resets when the server restarts.** Every change (customers, notes, saved filters, pipeline order) lives in memory only.
- **Seed data is deterministic.** The same people, companies and ids are generated every time. Timestamps are placed relative to the day the server starts, so date filters such as "last 30 days" always have matches.
- **Responses are delayed by 400 ms** so loading states are visible. Set the `MOCK_API_DELAY_MS` environment variable to change it.
- **Failures can be forced in development.** Open any page with `?fail=1` to make every API call fail, `?fail=queries` for reads only, or `?fail=mutations` for writes only. Production builds ignore this.

To use a real backend, either point the client in `features/customers/api/customers-api.ts` at it, or keep the route handlers and write a new implementation of the `CustomerRepository` interface in `server/customer-repository.ts`.

## Testing

```bash
npm test
```

The suite uses Vitest with Testing Library in jsdom.

- **Unit tests** cover the pure logic: the search/filter/sort/paginate engine, URL serialisation, filter helpers and templates, pipeline ordering, and CSV escaping.
- **Component tests** render whole views (the dashboard, the customers page, the pipeline) and drive them as a user would. Their `fetch` is routed to the app's real route handlers, backed by a fresh in-memory store per test, so they exercise the real validation, query logic and persistence rather than a hand-written fake.
- **Drag and drop** cannot be simulated in jsdom, which has no layout. The pipeline tests fire the same drag events dnd-kit would and run everything from the board's handlers onwards for real.

There is no end-to-end browser suite in the repository. Browser behaviour (real pointer and keyboard drags, downloads, responsive layouts, dark mode) was verified during development with scripted headless-browser runs that are not included here.

## Implementation decisions

- **Dashboard figures are list counts.** Each number is the `total` of a one-row list request with a filter, so the dashboard needs no endpoint of its own, stays consistent with the table, and refreshes whenever customer data changes.
- **Theme tokens carry the design.** Colours are defined once as CSS variables for the dark and light themes; components use the tokens rather than fixed colours, apart from the status colours.
- **Server-side list operations.** Search, filtering, sorting and pagination happen in the API, as they would against a real database. The list query key is the full parameter object, so each view is cached separately.
- **URL as the source of truth for list state.** Search, filters, sort and paging are read from and written to the query string. The parameter names are the same for the page URL and the API, and one module serialises and parses both. Default values are left out of the URL.
- **Draft and applied filters.** The filter panel edits a local draft; only Apply writes to the URL, which triggers one request.
- **Dates are calendar days in the viewer's time zone.** The client sends its IANA time zone with list requests and the API compares days in that zone, so a date filter agrees with the dates shown on screen.
- **One form for add and edit.** Both dialogs use the same form component and the same zod schema that the API validates with. API errors for a field appear under that field.
- **Mutations own their cache updates.** Each mutation hook invalidates or updates the queries it affects and stays pending until they have refetched, so a dialog never closes onto stale rows.
- **Optimistic pipeline moves.** A drop rewrites the cached list immediately, rolls back on failure and refetches once the last in-flight move settles.
- **Bulk actions only touch visible rows.** Selection is limited to the current page and is dropped when the page, search, sort or filters change.
- **CSV cells that look like formulas are neutralised.** A cell starting with `=`, `+`, `-` or `@` is prefixed with an apostrophe, which stops spreadsheet apps from running it as a formula. Phone numbers starting with `+` therefore appear as `'+1 …` in the raw file.
- **Focus returns to where it came from.** Dialogs opened by state rather than a trigger button restore focus to the element that opened them.

## Known limitations

- Data is not persisted; it resets on server restart, and on serverless hosting it may not be shared between requests.
- No authentication, users or permissions, so there is no profile or notification area in the header.
- The dashboard has figures and lists only; there are no charts.
- The pipeline board loads up to 500 matching customers in one request and shows a notice if there are more.
- On the board with filters applied, a card dropped last among the visible cards goes to the end of the full column, after any hidden cards.
- "Select all" selects the current page, not every matching customer.
- Phone numbers are not shown in the table below roughly 1600 px wide (they are in the details drawer and are searchable).
- At around 1280 px with the sidebar open, the five pipeline columns do not all fit and the board scrolls sideways.
- Date-range pickers are the browser's native date inputs, so their display format follows the browser's locale.
- Touch dragging on the pipeline was not tested on a physical device; the card menu offers the same moves.

## Future improvements

- A real database behind the repository interface, with authentication
- An end-to-end browser test suite in the repository
- "Select all matching" for bulk actions across pages
- Undo for delete and bulk actions
- Virtualised pipeline columns for very large datasets
- CSV import
- Activity history per customer
