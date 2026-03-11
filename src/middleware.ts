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

  if (
    pathname.startsWith("/academic-studio") &&
    !pathname.startsWith("/academic-studio/landing") &&
    !pathname.startsWith("/academic-studio/welcome")
  ) {
    const redirectUrl = new URL(request.url);
    const search = redirectUrl.searchParams;
    const rawWorkspace = search.get("workspace");
    const normalizedWorkspace = rawWorkspace
      ? rawWorkspace.trim().toLowerCase().replace(/[\s_]+/g, "-")
      : null;

    if (pathname === "/academic-studio") {
      redirectUrl.pathname = "/academic-studio/welcome";
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname === "/academic-studio/study-library") {
      redirectUrl.pathname = "/academic/study-hub";
      search.set("tab", "library");
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname.startsWith("/academic-studio/quiz/")) {
      redirectUrl.pathname = pathname.replace("/academic-studio/quiz/", "/academic/quiz/");
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname === "/academic-studio/dashboard") {
      if (normalizedWorkspace === "assignments") {
        redirectUrl.pathname = "/academic/assignments";
      } else if (normalizedWorkspace === "syllabi" || normalizedWorkspace === "syllabus") {
        redirectUrl.pathname = "/academic/syllabi";
      } else if (normalizedWorkspace === "paper-workflow" || normalizedWorkspace === "paperworkflow") {
        redirectUrl.pathname = "/academic/paper-workflow";
      } else if (normalizedWorkspace === "coding-review" || normalizedWorkspace === "codingreview") {
        redirectUrl.pathname = "/academic/coding-review";
      } else if (normalizedWorkspace === "math-mode" || normalizedWorkspace === "mathmode") {
        redirectUrl.pathname = "/academic/math-mode";
      } else if (normalizedWorkspace === "study-materials") {
        redirectUrl.pathname = "/academic/study-hub";
        search.set("tab", "ingest");
      } else if (normalizedWorkspace === "study-library" || normalizedWorkspace === "study-hub") {
        redirectUrl.pathname = "/academic/study-hub";
        search.set("tab", "library");
      } else if (normalizedWorkspace === "agenda") {
        redirectUrl.pathname = "/academic/agenda";
      } else {
        redirectUrl.pathname = "/academic/dashboard";
      }
      search.delete("workspace");
      return NextResponse.redirect(redirectUrl);
    }

    redirectUrl.pathname = "/academic/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const adminSecret = process.env.ADMIN_SECRET;
    const adminHeader = request.headers.get("x-admin-key");
    if (!adminSecret || adminHeader !== adminSecret) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }
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
    "/admin/:path*",
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
