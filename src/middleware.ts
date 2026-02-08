// Next.js Middleware for Route Protection
// src/middleware.ts

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = [
  "/career-studio",
  "/academic-studio",
  "/mirror-mode",
];

// Routes that are always public
const PUBLIC_ROUTES = [
  "/",
  "/api/auth",
  "/academic-studio/landing",
];

// API routes that require authentication
const PROTECTED_API_ROUTES = [
  "/api/academic",
  "/api/applications",
  "/api/quiz",
  "/api/study",
  "/api/travis",
  "/api/victor",
  "/api/resumes",
  "/api/resume-builder",
  "/api/cover-letter",
  "/api/tailored-resume",
  "/api/job-analysis",
  "/api/lex",
  "/api/mirror-mode",
  "/api/career-assessment",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/academic-studio") {
    const redirectUrl = new URL("/academic-studio/landing", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Skip public routes
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"))) {
    return NextResponse.next();
  }

  // Check if route needs protection
  const needsProtection =
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) ||
    PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route));

  if (!needsProtection) {
    return NextResponse.next();
  }

  // Create Supabase client with request cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Handle unauthenticated requests
  if (!user) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // For page routes, redirect to home with auth required param
    // The AuthContext will detect this and show login modal
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("auth", "required");
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
