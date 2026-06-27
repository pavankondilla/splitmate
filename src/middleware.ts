import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ratelimiters } from "@/lib/rate-limit";

const isPublicRoute = createRouteMatcher([
  "/",
  "/join(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const MUTATION_METHODS = new Set(["POST", "PATCH", "DELETE"]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  if (userId && isAuthRoute(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  // Rate-limit all mutation API requests (webhooks have svix signature verification)
  const { pathname } = request.nextUrl;
  const isMutation = MUTATION_METHODS.has(request.method);
  const isApiMutation =
    isMutation &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/webhooks");

  if (isApiMutation && ratelimiters) {
    const limiter = userId ? ratelimiters.authed : ratelimiters.anon;
    const key =
      userId ??
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      "unknown";

    const { success, limit, remaining, reset } = await limiter.limit(key);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
            "Retry-After": String(retryAfter),
          },
        }
      );
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
