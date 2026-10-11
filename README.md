# Trendz

The web app of Trendz Women's Wear: storefront, customer account, admin panel and counter billing (`/pos`) in one Next.js application. Its data comes from the API in the [`trendz-api`](https://github.com/Trendz-technologies/trendz-api) repository.

| | |
| --- | --- |
| **Stack** | Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query, React Hook Form + zod |
| **API** | Every request goes to `/api/*` on this app's own address and is passed on to the API (`API_INTERNAL_URL`), so sign-in cookies are first-party |
| **Hosting** | Vercel, with the API on Render. See [Deploying](#deploying) |

The system design, the API reference, the database and the security notes are documented in `trendz-api`.

---

## Local development

### Prerequisites

- **Node.js 22 or 24** (≥ 20.11) and npm 10+
- The **API running** on `http://127.0.0.1:4100`: clone `trendz-api` next to this repository and follow its README (it also sets up the database and the demo catalogue).

### First run

```bash
npm install
cp .env.example .env.local    # points at the API on 127.0.0.1:4100
npm run dev                   # http://localhost:3100
```

On a slow machine use a production build instead of the dev server: `npm run build`, then `npm run start`.

| Variable | Used for |
| --- | --- |
| `API_INTERNAL_URL` | Where this app reaches the API: server-side rendering and the `/api/*` rewrite |
| `NEXT_PUBLIC_SITE_URL` | The site's public address (canonical links, sitemap, Open Graph) |
| `NEXT_PUBLIC_MEDIA_ORIGIN` | The origin(s) pictures are shown from and uploaded to, separated by spaces. They are the only outside addresses the browser may load pictures from (Content-Security-Policy) |
| `NEXT_PUBLIC_STORE_NAME` | The shop's name in page titles |

All four are read when the app is built: after changing one, build again. No secret belongs here; every key lives with the API.

### Signing in

Staff sign in at `/login` with the account the API's seed created (see the `trendz-api` README); customers register at `/register`.

The storefront header follows the session: a signed-in shopper sees the wishlist, the bag and a round mark with their initials (it opens My account); a visitor sees one Login button instead. On phones the wishlist link is in the menu, where the bar has no room for it. A visitor can still add to the bag (the bag opens when they do) and is asked to sign in at checkout, as before.

### Appearance & theme

Admin → Appearance (`/admin/appearance`, needs `settings.read`; saving needs `settings.write`) sets the look of the whole app: storefront, admin and POS.

- **Two values are saved**: a mode (light or dark) and one brand colour, plus an optional text colour. They live in the `appearance` setting; the default is dark with brand pink `#ff3d9a`.
- **Everything else is generated** from them in `src/lib/theme.ts` (surfaces, hovers, soft tints, shadows, text on the brand colour) and set as CSS variables on `<html>`. `globals.css` holds the token names and the fallback values.
- **A save is live immediately.** The root layout paints the saved theme on the server, and saving drops the cached pages, so no visitor sees the old colours.
- **Shoppers can pick light or dark for themselves** with the sun / moon icon in the storefront header. The choice is kept in that browser's `localStorage` (key `trendz_theme`) and applies to storefront pages only: the saved mode is just what everyone sees first, and the admin and POS always use it. A small script at the top of `<body>` applies the choice before the first paint.
- **Writing new UI**: use the tokens (`bg-white` for cards, `text-ink`, `bg-accent`, `text-on-accent`, `border-black/10` …), never fixed colours, so it follows both modes. Blocks that must stay dark in light mode (footer, bands over photos) take the `on-dark` class.
- **Scrollbars** are thin and themed everywhere (storefront, admin, POS): 4px wide, or 4px high for sideways scrolling, in the brand colour, so they follow Appearance and light / dark mode, with rounded ends (`globals.css`; the curve is stretched along the bar, because a 4px bar is too narrow for an ordinary rounded corner to show). Firefox cannot size a scrollbar in pixels and shows its own thin one in the same colour. Carousels marked `no-scrollbar` still hide theirs.
- **Doodles (storefront only)**: big line drawings of a hanger, a dress, a needle and thread and so on sit behind every storefront page. `DoodleField` (`src/components/store/doodles.tsx`) is rendered once by the store layout; cards and photographs cover it, so it shows in the open parts of a page. The not-found and error pages sit outside that layout and are also shown for admin and POS addresses, so they use `StandaloneDoodles`, which adds the doodles in the browser for storefront addresses only. Where a large panel would hide it (the category and About banners, the sign-in card, the empty bag, the offers banner, the footer; the home page banner is kept plain) a single `<Doodle art="hanger" className="absolute w-64 text-gold/30 …" />` from `doodle.tsx` is placed inside the panel. They are drawn in the theme's gold and brand colour, are hidden from screen readers and never take a click. The admin and POS do not have them. To add a drawing, add it to `SHEET` (a 200 × 200 grid) and to the `DoodleArt` type.
- **Select inputs**: every dropdown in the storefront, admin and POS is `Select` from `@/components/ui`, drawn with [react-select](https://react-select.com) (`src/components/ui/select.tsx`). Use it like a native `<select>`: `<option>` children, `value` / `onChange={(e) => e.target.value}`, or react-hook-form's `{...register("field")}`. A hidden native `<select>` stays the real form control, so nothing else is needed. Size it with utilities on the component (`className="w-40"`, `h-8 text-xs`); lists of nine or more options can be typed into.

### Languages (English / Tamil)

The storefront has a language switch on the announcement strip at the top of every page (and in the mobile menu). The admin and POS are English only.

- **The choice is a cookie** (`trendz_lang`, one year). The store layout reads it on the server, so a page arrives already translated. Reading a cookie means storefront pages are rendered per request rather than served from the full-page cache; the API responses behind them are still cached.
- **The English sentence is the key.** Write `t("Add to bag")`; Tamil for it lives in `src/lib/i18n/ta/` (one file per area). A sentence with no Tamil entry is a TypeScript error.
  - Client components: `const { t, tn, tr, tx, ts, locale } = useI18n()` from `@/lib/i18n/client`.
  - Server components and metadata: `const { t } = await getI18n()` from `@/lib/i18n/server`.
  - `tn(count, "{n} item", "{n} items")` for plurals, `tr()` when a placeholder is an element, `msg()` for text defined outside a component, `date(value, locale)` for dates.
  - The not-found and error pages sit outside the store layout, so they use `useStandaloneI18n()`, which reads the cookie in the browser. Do not read it on the server there: that makes every route, the admin included, render per request.
- **Catalogue data is shown as typed in the admin.** Product names and descriptions are not translated. Category, option and colour names are translated when they are listed in `ta/data.ts` (looked up with `tx()`), as are order and payment statuses (`ts()`). Messages that come from the API (for example a validation error) are in English.
- **Tamil type**: Noto Sans Tamil and Noto Serif Tamil load only when Tamil is shown. `globals.css` drops Latin letter-spacing and loosens heading line height under `:lang(ta)`; use the `ta:` Tailwind variant (`ta:text-3xl`) where a Tamil heading needs its own size.
- `npm run i18n:check` lists text in the code that has no Tamil entry, translations that lost a `{placeholder}`, and unused entries.

### CMS (home page, about, contact, legal pages)

The CMS group in the admin sidebar holds what the storefront says. Every screen needs `settings.read`, saving needs `settings.write`, and a save shows on the store straight away.

| Admin screen | Edits | Storefront |
|---|---|---|
| Home page (`/admin/cms/home`) | The shop's logo (shown on every storefront page), then the home page sections from top to bottom: banner (headline, tagline, buttons, optional picture), Shop by category, Popular picks, the "about the collection" card, the delivery / returns / payment cards, New arrivals and the closing band. Each section below the banner can be switched off | `/` |
| Home page offers (`/admin/home-offers`) | The offers section under the banner (next heading) | `/` |
| About us (`/admin/cms/about`) | The About us page: the banner (small heading, heading, introduction, optional picture; the logo is shown without one) and the page text, written in a rich text editor. The page can be switched off | `/about` and its links in the header menu and the footer |
| Contact us (`/admin/cms/contact`) | Phone, WhatsApp number, email, Instagram handle, address, opening hours, a directions link and the contact page's heading | `/contact`, the footer of every page and every WhatsApp button |
| Terms & Conditions, Privacy Policy (`/admin/cms/terms`, `/admin/cms/privacy`) | A title and the page text, written in a rich text editor | `/terms`, `/privacy` and their footer links |

- **Two languages.** Every text is entered in English and Tamil; a shopper sees their language, and an empty one falls back to the other. A text left empty in both is left out of the page.
- **Legal pages start empty and unpublished.** Until a page is published, `/terms` or `/privacy` answers "not found" and the footer does not link to it. The shop writes its own wording; nothing is pre-filled.
- **The About us page starts written and shown.** Its starting text only repeats what the store already says (the collections, weekly arrivals, WhatsApp help, the shop and home delivery); the shop's own history is for the shop to add. Switched off, `/about` answers "not found" and the header and footer links disappear.
- **The shop's logo is uploaded on the Home page screen.** It replaces the logo that ships with the app in the header, the footer, the home page's closing band and the About banner (when that has no picture of its own); removing it brings the built-in one back. The store shows the logo on dark panels, so one drawn for a black or transparent background looks best. JPEG, PNG, WebP or AVIF, up to 2 MB, like every other picture. The admin and POS screens and the emails do not show a logo picture.
- **It is content only.** The delivery and returns headings on the home page state the free-shipping amount and the return window, so they are built from Settings rather than typed here, and can never disagree with checkout.
- **Contact details are not the invoice identity.** The legal name, GSTIN and address printed on invoices stay under Admin → Settings (`store`).
- **Where it lives**: the `homePage`, `contact`, `termsPage`, `privacyPage` and `aboutPage` settings (`src/modules/settings/cms.ts` (in `trendz-api`)). Their defaults are the text the storefront had before it became editable. The home page and contact details reach the storefront through `/store/config`; a legal page's text through `/store/pages/:slug` and the About us page through `/store/about`. Links are limited to paths on this site, pictures to files uploaded through the editor, and page text to an allow-list of tags (`src/common/utils/html.ts` (in `trendz-api`)).
- **If the API cannot supply it** (unreachable, or an older build), the storefront falls back to the same text from `src/lib/cms.ts`.
- **Adding another page** (for example a shipping policy): add its schema and slug to `PAGE_SETTINGS` in `cms.ts` and to `settingSchemas`, extend `PageSlug` in `src/lib/types.ts`, and add a storefront route, an admin route and a nav entry like the ones for `terms`.

### Home page offers

Admin → CMS → Home page offers (`/admin/home-offers`, needs `settings.read`; saving needs `settings.write`) edits the offers section under the banner on the home page.

- **What it holds**: a heading, up to four offer cards (ribbon, title, a line above the price, price, link, optional picture), a gift banner and a sale banner with a big figure such as "20%". Every text is entered in English and Tamil; a shopper sees their language, and an empty one falls back to the other.
- **Offer period**: the start and end dates are printed on the sale banner, and the whole section leaves the home page the day after the end date (India time). Clear the end date to keep it up.
- **It is content only.** Nothing here changes a price. A discount that should apply at checkout or at the billing counter is set up under Admin → Discounts or Coupons.
- **Where it lives**: the `homeOffers` setting (`src/modules/settings/home-offers.ts` (in `trendz-api`), whose defaults are the shop's grand-opening flyer), served to the storefront through `/store/config`. Links are limited to paths on this site and pictures to files uploaded through the editor. A save shows on the home page straight away.
- The section itself is `src/components/store/home-offers.tsx`. It is laid out with container queries, so the editor's preview and the home page render the same component.

### Product lists (infinite scroll)

Shop all, the category pages and search results load their products as the shopper scrolls (`src/components/store/listing-products.tsx`).

- **The first 24 products come with the page** (server-rendered, so they are there without JavaScript and for search engines). The next 24 are fetched from `/api/store/products` when the end of the list is about one screen away, and so on to the end.
- **The "Load more products" link under the list is a real link** to `?page=2`, `?page=3` …: it loads the next page on click, works without JavaScript, and gives search engines a path through the whole list. A page opened that way starts at that page and offers "Show products from the start".
- **Coming back from a product returns to the same place.** The loaded pages are kept by React Query (five minutes), so the list is as long as it was and the browser can restore the scroll position.
- **The counter in the toolbar** ("Showing 1–48 of 120") follows what is on the page, and the end of the list says so. A page that fails to load shows "Try again" instead of retrying by itself.
- Changing a filter or the sort order starts the list again from the top. The page size is the `limit` set in `components/store/listing.tsx`.

### Phone numbers

Every phone field in the storefront, admin and billing screen is the same component, `PhoneInput` (`src/components/ui/phone-input.tsx`), built on the `react-phone-number-input` package.

- **India only.** The country is fixed: the flag and `+91` are always in the field and cannot be removed. Digits are spaced as they are typed (`+91 98765 43210`), and a pasted number may come with or without the country code.
- **One stored form.** A field gives the form `+919876543210`, which is what the API keeps for customers and staff. A number saved earlier in another way (`98765 43210`, `0421 2241234`) is shown in the field's own form and left as it is until someone edits it.
- **Where a mobile is required** (sign-up, addresses, staff users) the number must be an Indian mobile; supplier and warehouse contacts may be landlines.
- **Size.** Only India's numbering rules are shipped, in `src/lib/phone-metadata.in.json` (5 KB instead of the library's 80–150 KB for every country). After upgrading the package, run `npm run phone:metadata` to write that file again.
- Pages that only print a number (footer, contact, about) space it with `displayPhone` in `src/lib/cms.ts`.

### Checkout while no payment gateway is connected

A shop without a Razorpay account yet runs its API with `PAYMENT_PROVIDER=none`, and `/store/config` then says `payments.provider: "none"`. The storefront keeps the catalogue, the bag and the totals. On the checkout page the payment step is replaced by "Online payment is not available yet, so orders cannot be placed on the website for now." with the shop's WhatsApp link, and the Place order button is off. The footer's Razorpay line and the announcement about secure checkout are left out. The API refuses the order as well, so the page is not the protection. Nothing changes here when the gateway is connected later: the page follows the API.

### Pictures

Pictures are uploaded by the browser straight to image storage (Cloudinary, or Cloudflare R2 / MinIO), with a ticket the API signs. Every picture may be at most 2 MB, in JPEG, PNG, WebP or AVIF; the admin says so beside each upload control and refuses a larger file before sending anything (`src/lib/upload.ts`; the API enforces the same limit). `NEXT_PUBLIC_MEDIA_ORIGIN` must list the storage's addresses: `https://res.cloudinary.com https://api.cloudinary.com` for Cloudinary.

## Checks

```bash
npm run lint
npm run typecheck
npm run i18n:check    # text with no Tamil entry, translations that lost a {placeholder}, unused entries
npm run build
```

CI (`.github/workflows/ci.yml`) runs all four on every push to `main` and on pull requests.

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on :3100 |
| `npm run build`, then `npm run start` | Production build, and serving it on :3100 |
| `npm run build:webpack` | The same build with webpack instead of Turbopack |
| `npm run i18n:check` | Check the Tamil dictionary against the code |
| `npm run phone:metadata` | Write India's phone numbering rules for the phone fields again (after upgrading `react-phone-number-input`) |

## Deploying

The app is deployed on **Vercel** from the `main` branch; the API it talks to runs on Render. The full walk-through, including the API, the database and the order to do things in, is `DEPLOYMENT.md` in `trendz-api`. The Vercel side in short:

1. Vercel → **Add New → Project** → import this repository. Vercel recognises Next.js; leave the build settings as they are.
2. Set the four variables from the table above: `API_INTERNAL_URL` is the API's address on Render (`https://<api>.onrender.com`, no trailing slash), `NEXT_PUBLIC_SITE_URL` the site's own address, and `NEXT_PUBLIC_MEDIA_ORIGIN` is `https://res.cloudinary.com https://api.cloudinary.com`.
3. Deploy, then set `WEB_URL` on the API to this site's address.

`vercel.json` runs the server-side code in Singapore, next to the API, and stops Vercel's CDN from keeping copies of `/api/*` answers. The API on Render's free plan sleeps after 15 minutes without a request: the first page after a quiet spell is slow, and falls back to built-in content where it can.

Vercel's Hobby plan is for personal, non-commercial use; a shop that takes orders needs a paid plan.

## Repository layout

```
src/app/(store)     storefront and customer account
src/app/admin       admin panel
src/app/pos         counter billing
src/components      ui kit, store, admin and pos components
src/lib             API client, i18n, theme, upload and phone helpers
scripts/            translation check, phone metadata
next.config.ts      the /api rewrite, Content-Security-Policy, build identifier
vercel.json         Vercel region and caching of /api
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Pages cannot load their data (errors, empty lists, or only the built-in text) | The API is not running or `API_INTERNAL_URL` is wrong. Locally: start it in `trendz-api`. On Vercel: check the variable, then redeploy |
| Port already in use | Another project is using 3100. Change `--port` in the `dev` and `start` scripts and `NEXT_PUBLIC_SITE_URL` |
| Pictures do not show | `NEXT_PUBLIC_MEDIA_ORIGIN` does not list the storage's address; fix it and build again. Locally with MinIO, Docker must be running |
| Controls look broken right after a rebuild (for example dropdowns with repeated arrows) | The tab was opened before the rebuild and is still running the old code. Reload it. Each build made with `next build` has its own identifier (`deploymentId` in `next.config.ts`, kept in `.deployment-id`), so a tab opened on an identified build reloads itself on its next click after a newer build. On Vercel the platform provides the identifier where its Skew Protection is on (not on the Hobby plan) |
| Camera scanning does not start on another device | Browsers allow the camera only on `https://` or `localhost`. Use a tunnel with HTTPS, or a USB scanner. |
| `next build` fails on Windows with `node process exited … 0xc0000142` | Turbopack could not start its CSS worker process (seen under heavy memory pressure). Build with webpack instead: `npm run build:webpack` |
