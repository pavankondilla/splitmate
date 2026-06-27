import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function createRatelimiters() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });

  return {
    // Authenticated users: 30 mutations per 60-second window
    authed: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "60s"),
      prefix: "rl:authed",
    }),
    // Unauthenticated (e.g. /join page, public endpoints): 10 per 60s per IP
    anon: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60s"),
      prefix: "rl:anon",
    }),
  };
}

export const ratelimiters = createRatelimiters();
