# vessel-landing
The dollar leverage pays for. Delta-neutral yield on @Monad

## Waitlist

The "Board early." form posts to a Fastify service that lives in `server/` in
this same repo. The landing page is static and deploys to Vercel; the API and
its Postgres deploy to Railway. Railway is the **only** store — there is no
serverless route or KV in the landing app.

### Deploy the API (Railway)

1. **New Project → Deploy from GitHub repo** → this repository.
2. In the service's **Settings → Root Directory**, set `server`.
   Railway reads `server/railway.json` and builds `server/Dockerfile`.
3. Add the **Postgres** plugin to the project. It provisions `DATABASE_URL`;
   reference it from the API service so the two stay linked.
4. Set the remaining service variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | from the Postgres plugin |
   | `RESEND_API_KEY` | your Resend key |
   | `RESEND_FROM` | `Vessel <crew@mail.vessel.wtf>` |
   | `ADMIN_KEY` | long random string, guards `/waitlist/list` |
   | `PORT` | `8080` |
   | `CORS_ORIGINS` | `https://vessel.wtf,https://www.vessel.wtf,https://testnet.vessel.wtf,http://localhost:3000` |
   | `IP_HASH_SALT` | optional, long random string (see below) |

5. Optionally add the custom domain `api.vessel.wtf` to the service.

The schema is created on boot — `citext` extension plus the `crew` table — so
there is no migration step.

`IP_HASH_SALT` is optional but recommended: `crew.ip_hash` stores a SHA-256 of
the client IP, and without a salt the (small) IPv4 space can be brute-forced
back to the original address.

### Point the landing page at it (Vercel)

This landing page is **static HTML with no build step**, so there is no
`NEXT_PUBLIC_*` to inject. The API origin lives in [`config.js`](config.js):

```js
window.VESSEL_CONFIG = {
  WAITLIST_API: "https://api.vessel.wtf"   // no trailing slash
};
```

Set it to `https://api.vessel.wtf` or the `*.up.railway.app` URL and redeploy.
If this ever becomes a Next app, that value is what `NEXT_PUBLIC_WAITLIST_API`
should hold.

`config.js` ships to the browser. Only public values belong in it — never
`ADMIN_KEY`, `DATABASE_URL` or `RESEND_API_KEY`.

### Routes

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /health` | — | `{ok, db, resendConfigured}` |
| `GET /waitlist/count` | — | `{count}`, `Cache-Control: max-age=5` |
| `POST /waitlist` | — | `{email, website?}`; rate limited 5 / 10 min / IP |
| `GET /waitlist/list` | `x-admin-key` | newest first, capped at 2000 |

`website` is a honeypot. If it arrives non-empty the API returns `204` and
stores nothing. A repeat signup returns the crew number it issued the first
time and does **not** send a second email. A Resend failure never fails a
signup — the row is committed and the response carries `mailed: false`.

```bash
# health
curl -s https://api.vessel.wtf/health

# public count
curl -s https://api.vessel.wtf/waitlist/count

# sign up
curl -s -X POST https://api.vessel.wtf/waitlist \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","website":""}'
# -> {"ok":true,"n":1,"mailed":true}

# same address again — same number, no second email
curl -s -X POST https://api.vessel.wtf/waitlist \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com"}'
# -> {"ok":true,"duplicate":true,"n":1,"mailed":false}

# export (admin)
curl -s https://api.vessel.wtf/waitlist/list -H "x-admin-key: $ADMIN_KEY"
```

### Local development

```bash
docker run -d --name vessel-pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=vessel \
  -p 55432:5432 postgres:16-alpine

cd server && pnpm install
DATABASE_URL='postgresql://postgres:pw@127.0.0.1:55432/vessel?sslmode=disable' \
ADMIN_KEY=dev PORT=8080 \
CORS_ORIGINS=http://localhost:3000 pnpm dev
```

Serve the landing page from `http://localhost:3000` (it is in `CORS_ORIGINS`)
and point `config.js` at `http://localhost:8080`.

### Email

Resend sends **only** as `crew@mail.vessel.wtf`, the subdomain verified for
outbound. Inbound `hello@vessel.wtf` is unchanged and still handled by
Cloudflare — this service does not touch it.
