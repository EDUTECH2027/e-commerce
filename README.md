# Online store with WhatsApp ordering

A fast, mobile-first product catalogue for electronics, appliances and household goods. Customers browse, open a
product, and tap **Order on WhatsApp**; WhatsApp opens with a message about that exact product already written.
There is **no checkout, no online payment and no automated installment approval**. The 30% / 40% deposit offer is
shown as information only and is agreed with the seller on WhatsApp.

**Stack:** React 19 + TypeScript + Tailwind CSS 4 (Vite) · Express 5 · SQLite (`node:sqlite`, built into Node 24) ·
sharp for image optimisation. Requires **Node 24+**.

## Quick start

```bash
npm install
npm run seed:demo      # optional: 12 sample products (delete them before going live)
npm run dev            # storefront http://localhost:5173  ·  API http://localhost:3001
```

On first start an owner account is created and its **password is printed once in the terminal**. Set your own with
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (see `.env.example`). Sign in at **/admin**, then open **Settings** and enter your
WhatsApp number (the dashboard reminds you until you do).

## Production

```bash
npm run build
NODE_ENV=production npm start     # serves the site, API and uploads on $PORT (default 3001)
```

Express serves the built app and injects per-page title, description, Open Graph and JSON-LD tags, so Facebook and
WhatsApp link previews work (a plain single-page app cannot do this). Put it behind HTTPS (nginx, Caddy or your
host's proxy), set `TRUST_PROXY=1`, and set `PUBLIC_URL` or the "Website address" in Settings.
**Back up the `data/` folder** (database + uploaded images).

## Languages (English · Français · العربية)

* Visitors switch language in the header; the choice is remembered. First visit: `?lang=fr` in the link, else the browser's language, else English. Arabic switches the whole layout to right-to-left.
* **Interface text** (buttons, labels, section titles, the WhatsApp message itself) lives in `src/i18n/messages.ts`. The French and Arabic were written without a native-speaker review; please have someone read them.
* **Your own content** is typed in English, then translated in the admin: *Products → Edit → Translations*, *Categories → Edit*, and *Settings → Translations* (headline, banner, description, payment explanation). Empty fields fall back to English. The starter categories and default homepage texts already come with French and Arabic, and those defaults only apply while the English text is unchanged.
* Not translated: specification labels/values and colour names (shown as typed), and the admin dashboard (English only).
* **Ads:** add `?lang=fr` or `?lang=ar` to a product link to give that audience a French/Arabic page and Facebook/WhatsApp preview. The link a customer sends you in WhatsApp stays language-neutral.

## What the owner can do (/admin)

| Area | Features |
| --- | --- |
| Dashboard | totals, out-of-stock, featured, recent products, WhatsApp clicks (30 days) by product and traffic source |
| Products | add / edit / delete, multiple photos with preview, specs, colours, regular + promo price, stock status, featured, best seller, flexible-payment on/off, search and filters, quick toggles |
| Categories | create / edit / delete, image, visibility |
| Settings | business name, logo, description, WhatsApp, phone, email, address, social links, currency, homepage messages, deposit percentages and months, Meta Pixel ID, website address |
| Team | owner can add **editors** (products and categories only; no settings or team access) |

## WhatsApp

Links use `https://wa.me/<number>?text=<encoded message>`. The number comes only from Settings; it is never
hardcoded. Messages are built in `src/lib/whatsapp.ts` from the live product, price, chosen colour, settings and
product URL. Plain `<a>` links are used, so they work on phones and desktop and are not blocked as pop-ups.
Buttons: product page (plus a sticky bar on mobile), floating bubble, header, homepage section, footer, and
"Share on WhatsApp" per product.

## Facebook / Instagram ads

* Every product has a permanent URL `/products/<slug>`; the slug does not change when you rename a product, so
  links inside live ads keep working. Send ad traffic straight to it.
* Add `?utm_source=facebook&utm_medium=paid&utm_campaign=tv_promo` to ad URLs. They are remembered for the visit and
  attached to Pixel events and to the dashboard's click tally.
* Enter the **Meta Pixel ID** in Settings. Events: `PageView`, `ViewContent` (product page), `Lead` (Order on
  WhatsApp, with product id, name and value in XAF), `Contact` (general WhatsApp buttons). Optimise ads for `Lead`.
  If you target regions that require cookie consent, add a consent banner before enabling the Pixel.
* Test previews with Meta's Sharing Debugger after deploying (it must reach your public URL).
* `/sitemap.xml` and `/robots.txt` are generated; `/admin` is `noindex`.

## Security notes

Passwords are bcrypt-hashed; sessions are httpOnly `SameSite=Strict` cookies (the CSRF defence); sign-in is rate
limited; all input is validated with zod; uploads are decoded and re-encoded by sharp (so non-images are rejected)
and stored under random names; Helmet sets a strict CSP; admin routes require a session, settings and team
require the owner role.

## Layout

```
server/   Express API, SQLite access (lib/), auth, SEO rendering, seed-demo
shared/   types, phone normalisation and installment maths used by both sides
src/      storefront (pages, components), admin/ (lazy-loaded), lib/ (api, whatsapp, tracking)
data/     created at runtime: store.db and uploads/ (git-ignored)
```

## Future payments

Persistence is isolated in `server/lib/*` and prices are plain integers, so online payment or instalment tracking
could later be added as new modules (orders table, provider webhook) without reworking the catalogue. Not built now,
by design.

## Known limitations

* Arabic uses Latin digits and comma separators for prices (common in Cameroon); easy to change in `src/lib/format.ts`.
* Search matches the text as typed in English (product names in French/Arabic are not searched yet).
* `node:sqlite` is flagged experimental by Node and prints a warning; for multi-server hosting migrate `server/lib/*` to PostgreSQL.
* If an image upload succeeds but the product save fails, the uploaded files stay on disk unreferenced.
