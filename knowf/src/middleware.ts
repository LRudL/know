import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

console.log("[Middleware-SRC FOLDER] File loaded - basic test");

export async function middleware(req: NextRequest) {
  console.log("[Middleware] Request:", {
    pathname: req.nextUrl.pathname,
    method: req.method,
  });

  // Only forward /api/ routes to backend
  if (req.nextUrl.pathname.startsWith("/api/")) {
    console.log("[Middleware] Forwarding API request to backend");

    // Get auth session
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Create backend URL (replacing localhost:3000 with 127.0.0.1:8000)
    const backendUrl = new URL(
      req.url.replace(
        "http://localhost:3000/api/",
        "http://127.0.0.1:8000/api/"
      )
    );

    console.log("[Middleware] Forwarding to:", backendUrl.toString());

    // Forward with auth header
    const headers = new Headers(req.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    return new NextResponse(
      new ReadableStream({
        async start(controller) {
          const response = await fetch(backendUrl, { headers });
          const reader = response.body?.getReader();
          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
