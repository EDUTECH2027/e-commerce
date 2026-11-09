# Deploying everything on Vercel

The whole store runs on Vercel: the pages from its CDN, the API as one serverless function (`api/index.ts`), the
products in a **Neon Postgres** database and the photos in **Vercel Blob**. Both are created from the Vercel
dashboard and connected to your project with a click, so there is nothing to install or host yourself.

> **Plan:** Vercel's free *Hobby* plan is for non-commercial use only. A shop should be on the **Pro** plan.

## 1. Create the project

1. Push this repository to GitHub (already done: `EDUTECH2027/e-commerce`).
2. Vercel → **Add New → Project** → import the repository. Framework: **Vite** (detected from `vercel.json`).
3. **Settings → General → Node.js Version: 24.x**.

Don't deploy yet, or deploy and ignore the first error. The next steps add the database and storage.

## 2. Add the database (Neon Postgres)

Project → **Storage** → **Create Database** → **Neon** → choose a region close to your customers (for Cameroon,
Europe is usually the closest) → connect it to this project for **all environments**.
This adds the `DATABASE_URL` variable automatically.

## 3. Add image storage (Vercel Blob)

Project → **Storage** → **Create Database** → **Blob** → connect to this project (public access).
This adds `BLOB_READ_WRITE_TOKEN` automatically.

## 4. Add your settings

Project → **Settings → Environment Variables** (Production):

| Name | Value | Why |
| --- | --- | --- |
| `ADMIN_EMAIL` | the email you will sign in with | creates the owner account on the first visit |
| `ADMIN_PASSWORD` | a long password | same. **Only used the first time**; afterwards change it in Admin → Settings |
| `JWT_SECRET` | a long random string (optional) | if you leave it out one is generated and stored in the database |
| `PUBLIC_URL` | `https://your-domain.com` (optional) | used in link previews, the sitemap and WhatsApp product links |

## 5. Deploy

**Deployments → Redeploy** (variables added after a deployment only apply to the next one).
Open the site. The first visit takes a few seconds: it creates the tables, the owner account and the starter
categories. Then sign in at `/admin` and enter your **WhatsApp number** in Settings.

## 6. Move the products you created locally

Your earlier local version stored everything in `data/store.db`. To copy those products, categories, settings and
images to the live site (once, from your computer):

```bash
npx vercel link                              # connect this folder to the Vercel project
npx vercel env pull .env.production.local    # downloads DATABASE_URL and BLOB_READ_WRITE_TOKEN
npx tsx --env-file=.env.production.local server/migrate-sqlite.ts
```

It refuses to run if the live database already contains products, never changes your local files, and does not
copy admin accounts. Delete `.env.production.local` afterwards (it contains secrets; it is git-ignored).

To bring the same data into your *local* development database, stop `npm run dev` and run `npm run migrate:sqlite`.

## Day to day

* **Add or edit products** in `/admin` on the live site. Changes show within a few seconds.
* **Code changes:** push to GitHub, Vercel redeploys automatically.
* **Back up:** Neon keeps point-in-time history on paid plans; Blob files are stored by Vercel. For your own
  copy of the data, use Neon's dashboard export.

## How it is wired

```
browser ──► Vercel CDN ──► static files from dist/ (the React app, fonts, scripts)
                      └──► everything else ──► api/index.ts  (Express, one serverless function)
                                                 ├─ /api/*   JSON API and admin API
                                                 └─ pages    index.html + per-page title / Open Graph tags
                                                              (so Facebook and WhatsApp previews work)
database: Neon Postgres  (DATABASE_URL)        photos: Vercel Blob (BLOB_READ_WRITE_TOKEN)
```

Catalogue responses are cached by the CDN for 10 seconds, pages for 30 seconds, so ad traffic does not hit the
database on every view. The admin API is never cached.

## Troubleshooting

* **Every page shows an error / `/api/home` returns 500:** open Vercel → your project → **Logs**. The line says
  what is missing, most often `DATABASE_URL is not set` (step 2, then redeploy).
* **Uploading a photo fails with "storage is not configured":** step 3, then redeploy.
* **Can't sign in on the first visit:** the owner is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` *when the first
  page is opened after deploying*. If you set them later, delete the rows in the `users` table (Neon dashboard → SQL
  editor: `DELETE FROM users;`) and reload the site.
* **First request after a quiet period is slow (~1 s):** Neon's free database pauses when idle and wakes on demand.
