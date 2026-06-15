import { NextRequest, NextResponse } from "next/server"
import { fetchAuthSession } from "aws-amplify/auth/server"

import { isAuthConfigured } from "@/lib/auth/amplify-config"
import { runWithAmplifyServerContext } from "@/lib/auth/server"

const PUBLIC_PATHS = ["/login"]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (pathname.startsWith("/content/preview/")) return true
  if (pathname.startsWith("/api/")) return true
  return false
}

async function isAuthenticated(request: NextRequest, response: NextResponse) {
  return runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec)
        return (
          session.tokens?.accessToken !== undefined &&
          session.tokens?.idToken !== undefined
        )
      } catch {
        return false
      }
    },
  })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next()
  }

  if (!isAuthConfigured) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next()
    }
    return new NextResponse("Authentication is not configured.", {
      status: 503,
    })
  }

  const response = NextResponse.next()
  const authenticated = await isAuthenticated(request, response)

  if (pathname === "/login") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return response
  }

  if (isPublicPath(pathname)) {
    return response
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
