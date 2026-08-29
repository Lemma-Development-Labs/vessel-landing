import { timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

import { config } from "./config.js";
import {
  addToWaitlist,
  countCrew,
  dbHealthy,
  hashIp,
  initSchema,
  listCrew,
  removeFromWaitlist,
  pool,
} from "./db.js";
import { sendWelcome } from "./mail.js";
import { hit, limits } from "./ratelimit.js";

const app = Fastify({
  // Trust only the hops we actually have (Railway's edge = 1). `true` would
  // trust the whole X-Forwarded-For chain, letting any client spoof a fresh
  // source IP per request and walk straight past the rate limiter.
  // hopIndex counts right-to-left from the socket peer, so this trusts the
  // first N proxies and treats the next entry as the real client.
  trustProxy: (_addr: string, hopIndex: number) => hopIndex < config.trustProxyHops,
  bodyLimit: 16 * 1024,
  logger: {
    level: config.logLevel,
    // Emails are PII: keep them out of the request log entirely.
    redact: {
      paths: ["req.body.email", "req.headers.authorization", "req.headers['x-admin-key']"],
      remove: true,
    },
    serializers: {
      req(req) {
        return { method: req.method, url: req.url };
      },
    },
  },
});

await app.register(cors, {
  origin(origin, cb) {
    // Same-origin/curl/server-to-server requests send no Origin header.
    if (!origin) return cb(null, true);
    cb(null, config.corsOrigins.includes(origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-key"],
  credentials: false,
  maxAge: 86_400,
});

/* -------------------------------------------------------------- health --- */

app.get("/health", async () => ({
  ok: true,
  db: await dbHealthy(),
  resendConfigured: config.resendConfigured,
}));

/* --------------------------------------------------------------- count --- */

app.get("/waitlist/count", async (_req, reply) => {
  const count = await countCrew();
  reply.header("Cache-Control", "public, max-age=5");
  return { count };
});

/* -------------------------------------------------------------- signup --- */

const SignupBody = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email(),
  website: z.string().optional(),
  source: z.string().trim().max(64).optional(),
});

/**
 * Stable client identity for rate limiting.
 *
 * Railway's edge OVERWRITES x-real-ip and x-forwarded-for with the true client
 * address — verified by attempting to forge both, which were discarded. It then
 * APPENDS its own internal address to x-forwarded-for, and that address rotates
 * per request. So req.ip (which reads from the right) is unstable and gave every
 * request its own bucket, defeating the limiter entirely.
 *
 * The leftmost entry / x-real-ip is the real client and is not forgeable here.
 * Only trusted when a proxy is actually in front (TRUST_PROXY_HOPS > 0); with no
 * proxy these headers ARE client-controlled, so we fall back to the socket peer.
 */
function clientKey(req: { headers: Record<string, unknown>; ip: string }): string {
  if (config.trustProxyHops > 0) {
    const raw = req.headers["x-real-ip"] ?? req.headers["x-forwarded-for"];
    const val = Array.isArray(raw) ? raw[0] : raw;
    if (typeof val === "string" && val.length > 0) {
      const first = val.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  return req.ip;
}

app.post("/waitlist", async (req, reply) => {
  const raw = (req.body ?? {}) as Record<string, unknown>;

  // Honeypot first: a bot that filled it gets a clean 204 and learns nothing.
  // No insert, no mail, no rate-limit consumption.
  const website = typeof raw.website === "string" ? raw.website.trim() : "";
  if (website.length > 0) {
    req.log.info({ event: "honeypot" }, "signup rejected");
    return reply.code(204).send();
  }

  const parsed = SignupBody.safeParse(raw);
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: "invalid_email" });
  }
  const { email, source } = parsed.data;

  const key = clientKey(req);
  const verdict = hit(key);
  if (verdict.limited) {
    // Log it: a silent 429 is indistinguishable from an outage when a user
    // reports "it doesn't work". The key is hashed — never log a raw IP.
    req.log.warn(
      { event: "rate_limited", client: hashIp(key)?.slice(0, 12), retryAfterSec: verdict.retryAfterSec },
      "signup throttled",
    );
    reply.header("Retry-After", String(verdict.retryAfterSec));
    return reply.code(429).send({ ok: false, error: "rate_limited" });
  }

  let result;
  try {
    result = await addToWaitlist(email, source ?? "landing", hashIp(key));
  } catch (err) {
    req.log.error({ reason: err instanceof Error ? err.message : "unknown" }, "signup insert failed");
    return reply.code(500).send({ ok: false, error: "server_error" });
  }

  if (result.duplicate) {
    // Already aboard — same crew number as before, and no second email.
    return reply.code(200).send({ ok: true, duplicate: true, n: result.n, mailed: false });
  }

  const mailed = await sendWelcome(email, result.n, req.log);
  return reply.code(200).send({ ok: true, n: result.n, mailed });
});

/* ---------------------------------------------------------------- list --- */

/** Constant-time compare so a wrong key leaks no information via timing. */
function keyMatches(provided: string | undefined, expected: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which would itself be a signal.
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

app.get("/waitlist/list", async (req, reply) => {
  // Rate limited too: this endpoint guards every stored address, so it must
  // not be a free oracle for brute-forcing ADMIN_KEY.
  const verdict = hit("admin:" + clientKey(req), limits.ADMIN_HITS);
  if (verdict.limited) {
    reply.header("Retry-After", String(verdict.retryAfterSec));
    return reply.code(429).send({ ok: false, error: "rate_limited" });
  }

  const provided = req.headers["x-admin-key"];
  const key = Array.isArray(provided) ? provided[0] : provided;

  // An unset ADMIN_KEY must not make the endpoint public.
  if (!keyMatches(key, config.adminKey)) {
    return reply.code(401).send({ ok: false, error: "unauthorized" });
  }

  reply.header("Cache-Control", "no-store");
  return { emails: await listCrew(2000) };
});


/* -------------------------------------------------------------- remove --- */

const RemoveBody = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
});

app.post("/waitlist/remove", async (req, reply) => {
  const verdict = hit("admin:" + clientKey(req), limits.ADMIN_HITS);
  if (verdict.limited) {
    reply.header("Retry-After", String(verdict.retryAfterSec));
    return reply.code(429).send({ ok: false, error: "rate_limited" });
  }

  const provided = req.headers["x-admin-key"];
  const key = Array.isArray(provided) ? provided[0] : provided;
  if (!keyMatches(key, config.adminKey)) {
    return reply.code(401).send({ ok: false, error: "unauthorized" });
  }

  const parsed = RemoveBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ ok: false, error: "invalid_email" });
  }

  // Deletes exactly one address — there is deliberately no bulk or wildcard
  // form, so a leaked key cannot empty the table in one call.
  const removed = await removeFromWaitlist(parsed.data.email);
  req.log.info({ removed }, "waitlist removal");   // count only, never the address
  reply.header("Cache-Control", "no-store");
  return { ok: true, removed };
});

/* ---------------------------------------------------------------- boot --- */

app.setNotFoundHandler((_req, reply) => reply.code(404).send({ ok: false, error: "not_found" }));

app.setErrorHandler((err: FastifyError, req, reply) => {
  req.log.error({ reason: err.message }, "unhandled error");
  // Never leak internals to the caller.
  const status = typeof err.statusCode === "number" && err.statusCode < 500 ? err.statusCode : 500;
  reply.code(status).send({ ok: false, error: "server_error" });
});

async function main() {
  try {
    await initSchema();
    app.log.info("schema ready");
  } catch (err) {
    app.log.error(
      { reason: err instanceof Error ? err.message : "unknown" },
      "schema bootstrap failed — refusing to start",
    );
    process.exit(1);
  }

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    { corsOrigins: config.corsOrigins.length, resendConfigured: config.resendConfigured },
    "waitlist api up",
  );
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    app.log.info({ sig }, "shutting down");
    app.close().then(() => pool.end()).finally(() => process.exit(0));
  });
}

main().catch((err) => {
  app.log.error({ reason: err instanceof Error ? err.message : "unknown" }, "boot failed");
  process.exit(1);
});
