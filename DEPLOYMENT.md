# VMSA Deacon Tracker — Setup & Deployment Guide

This app is a normal Next.js app. Nothing here is exotic — three free
accounts, two SQL scripts, and a `git push`.

## 1. Create the Supabase project (database)

1. Go to [supabase.com](https://supabase.com) and sign up / sign in (free tier — no credit card required).
2. Click **New project**. Pick any name (e.g. `vmsa-deacon-tracker`), a strong database password (save it), and the region closest to your church.
3. Wait ~2 minutes for provisioning.
4. Open **SQL Editor** (left sidebar) → **New query**.
5. Paste the entire contents of [`db/0001_init.sql`](db/0001_init.sql) and click **Run**.
6. New query again → paste [`db/0002_seed.sql`](db/0002_seed.sql) and click **Run**.
   - Before running, edit the last line if the SystemAdmin should be someone other than `magpsaad@gmail.com`.
7. Go to **Settings → Database → Connection string → URI**. Copy the one labeled **Transaction pooler** (port `6543`) — this is the one that works from serverless functions (Vercel). Substitute your actual database password into it.

That connection string is your `DATABASE_URL`.

## 2. Create Google OAuth credentials (admin sign-in)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or reuse one).
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in the required fields, and publish it to production (so it isn't limited to test users).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for local dev)
     - `https://<your-vercel-domain>/api/auth/callback/google` (add this after step 3 below, once you know the domain)
4. Copy the **Client ID** and **Client secret** — these become `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 3. Deploy to Vercel (hosting)

1. Push this repository to GitHub (create a new repo, then `git remote add origin <url>` and `git push -u origin main`).
2. Go to [vercel.com](https://vercel.com), sign up/sign in (free Hobby tier), and **Add New Project** → import the GitHub repo.
3. Before deploying, add these **Environment Variables** (Project Settings → Environment Variables), for both Production and Preview:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Supabase pooler connection string from step 1.7 |
   | `GOOGLE_CLIENT_ID` | from step 2.4 |
   | `GOOGLE_CLIENT_SECRET` | from step 2.4 |
   | `AUTH_SECRET` | run `npx auth secret` locally and paste the generated value |
   | `CHURCH_TIMEZONE` | `America/New_York` (or your church's IANA timezone) |

4. Click **Deploy**. Vercel builds and gives you a `https://<something>.vercel.app` URL.
5. Go back to Google Cloud Console and add `https://<something>.vercel.app/api/auth/callback/google` as an authorized redirect URI (step 2.3).
6. (Optional) Add a custom domain under Project Settings → Domains — free on Vercel's Hobby tier, and add its own callback URL to Google too.

## 4. First login

- Sign in with Google using the email seeded as SystemAdmin in `0002_seed.sql`.
- From **Access & Roles**, grant access to other admins/deacons as needed.
- From **Deacons**, add the church's roster. From **Settings**, review the seeded locations/activities and adjust if needed.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the same values as above
npm run dev
```

## Cost

Every piece of this stack (Supabase free tier, Vercel Hobby tier, Google OAuth) has a genuine, uncapped-in-time free tier that comfortably covers a few dozen users and a few hundred writes/week. Nothing here has a trial period that expires.
