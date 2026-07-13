# Deploy the SAT Platform to Cloudflare Pages — Step by Step

Total time: ~30 minutes. Cost: $0 (plus ~$10/year if you buy a domain).

## Prerequisites

- Your GitHub repo is up to date (`git push origin main`).
- Supabase project is live with all migrations applied.

## Part A — Put the site online (free .pages.dev URL)

1. Go to https://dash.cloudflare.com and create a free account (or log in).
2. In the left menu, open **Workers & Pages**.
3. Click **Create application** → **Pages** tab → **Connect to Git**.
4. Choose **GitHub**, sign in, and click **Install & Authorize**. When asked which repositories, you can grant access to only your Platform repo.
5. Select your Platform repository → **Begin setup**.
6. On "Set up builds and deployments":
   - **Project name**: e.g. `sat-platform` (this becomes `sat-platform.pages.dev`)
   - **Production branch**: `main`
   - **Framework preset**: None
   - **Build command**: leave BLANK (the site has no build step)
   - **Build output directory**: `/` (repo root)
7. Click **Save and Deploy**. The first deploy takes under a minute.
8. Open the URL it gives you (`https://sat-platform.pages.dev`) — the site is live.

From now on, every `git push` to `main` deploys automatically. Other branches get preview URLs.

## Part B — Connect Supabase to the live URL (required, or login breaks)

9. Open your Supabase dashboard → your project → **Authentication** → **URL Configuration**.
10. Set **Site URL** to your live URL (e.g. `https://sat-platform.pages.dev`).
11. Add the same URL to **Redirect URLs**. If you add a custom domain later, add that too.
12. Rotate the anon key (the old one was committed publicly): **Settings → API → rotate anon/public key**, paste the new key into `supabase-config.js`, commit, push (auto-deploys).
13. Test on the live URL: log in as admin and as a student, start a test.

You can stop here — the platform is fully live on the free `.pages.dev` address.

## Part C — Custom domain (optional, ~$10/year)

Option 1 — buy the domain at Cloudflare (simplest, at-cost pricing):

14. In the Cloudflare dashboard: **Domain Registration** → **Register Domains**.
15. Search a name (e.g. `satprep.uz`-style names may need a local registrar; `.com`/`.org`/`.net` work directly), pay, done — DNS is automatically managed by Cloudflare.

Option 2 — you already own a domain elsewhere (Namecheap, GoDaddy, ahost.uz, etc.):

14. Cloudflare dashboard → **Add a domain** → enter your domain → choose the Free plan.
15. Cloudflare shows two nameservers (like `ana.ns.cloudflare.com`). In your registrar's control panel, replace the existing nameservers with those two. Propagation takes minutes to a few hours.

Then connect the domain to your site:

16. **Workers & Pages** → your project → **Custom domains** tab → **Set up a custom domain**.
17. Enter your domain (e.g. `satprep.com`), confirm. Cloudflare creates the DNS record and issues free SSL automatically.
18. Optionally add `www.` the same way (or set a redirect from www to the apex).
19. Add the custom domain to Supabase **Authentication → URL Configuration → Redirect URLs** (keep the .pages.dev one too).
20. Visit `https://yourdomain.com` — done.

## Part D — After launch

- Rollbacks: Workers & Pages → your project → Deployments → "..." on any old deployment → Rollback.
- Free visitor analytics: project → Settings → enable Web Analytics.
- To take the site down temporarily: project → Settings → disable, or delete the custom domain.

## Note for `.uz` domains

`.uz` domains are registered through accredited Uzbek registrars (e.g. ahost.uz, webspace.uz). Buy there, then follow Option 2 above (point nameservers at Cloudflare).
