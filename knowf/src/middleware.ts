import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function handlePostOrDelete(
  req: NextRequest,
  backendUrl: URL,
  session: { access_token: string } | null
) {
  const headers = new Headers(req.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  // For POST requests, get the body
  let body;
  try {
    body = req.method === "POST" ? await req.json() : undefined;
  } catch (e) {
    console.error("[Middleware] Error parsing request body:", e);
    body = undefined;
  }

  console.log("[Middleware] Making request:", {
    method: req.method,
    url: backendUrl.toString(),
    hasAuth: !!session?.access_token,
  });

  const response = await fetch(backendUrl, {
    method: req.method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    console.error("[Middleware] Backend error:", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  try {
    const data = await response.json();
    return new NextResponse(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Middleware] Error parsing response:", e);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function middleware(req: NextRequest) {
  // EDIT WITH EXTREME CARE, an error here can become a hard-to-fix nightmare
  // especially, DO NOT TOUCH the streaming part
  console.log("[Middleware] Request:", {
    pathname: req.nextUrl.pathname,
    method: req.method,
  });

  if (req.nextUrl.pathname.startsWith("/api/")) {
    console.log("[Middleware] Forwarding API request to backend");

    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const backendUrl = new URL(
      req.url.replace(
        "http://localhost:3000/api/",
        "http://127.0.0.1:8000/api/"
      )
    );

    console.log("[Middleware] Forwarding to:", backendUrl.toString());

    if (req.method === "POST" || req.method === "DELETE") {
      return handlePostOrDelete(req, backendUrl, session);
    }

    return new NextResponse(
      new ReadableStream({
        async start(controller) {
          const headers = new Headers(req.headers);
          if (session?.access_token) {
            headers.set("Authorization", `Bearer ${session.access_token}`);
          }
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
