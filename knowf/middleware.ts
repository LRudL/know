import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // API forwarding
  if (req.nextUrl.pathname.startsWith('/api/')) {
    try {
      return NextResponse.rewrite(new URL(req.url.replace('/api/', 'http://localhost:8000/api/')))
    } catch (error) {
      return new NextResponse(
        JSON.stringify({ error: 'Backend service unavailable' }),
        { status: 503 }
      )
    }
  }

  // Auth protection
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If no session and trying to access protected route, redirect to login
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}