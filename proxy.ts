import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isProtectedUserRoute(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/family' ||
    pathname.startsWith('/family/')
  )
}

function isAdminRoute(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

function getReturnTo(request: NextRequest) {
  const query = request.nextUrl.search || ''
  return `${request.nextUrl.pathname}${query}`
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const adminRoute = isAdminRoute(pathname)
  const isAdminLogin = pathname === '/admin/login'
  const protectedUserRoute = isProtectedUserRoute(pathname)

  if (!adminRoute && !protectedUserRoute) {
    return NextResponse.next({ request })
  }

  if (isAdminLogin) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      throw userError
    }

    if (!user) {
      if (adminRoute) {
        const adminLoginUrl = request.nextUrl.clone()
        adminLoginUrl.pathname = '/admin/login'
        adminLoginUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(adminLoginUrl)
      }

      if (protectedUserRoute) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        loginUrl.searchParams.set('returnTo', getReturnTo(request))
        return NextResponse.redirect(loginUrl)
      }
    }

    if (adminRoute) {
      const { data: adminRow, error: adminError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle()

      if (adminError || !adminRow) {
        const adminLoginUrl = request.nextUrl.clone()
        adminLoginUrl.pathname = '/admin/login'
        adminLoginUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(adminLoginUrl)
      }
    }

    return response
  } catch (error) {
    console.error('Proxy auth check failed:', error)

    if (adminRoute) {
      const adminLoginUrl = request.nextUrl.clone()
      adminLoginUrl.pathname = '/admin/login'
      adminLoginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(adminLoginUrl)
    }

    if (protectedUserRoute) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('returnTo', getReturnTo(request))
      return NextResponse.redirect(loginUrl)
    }

    return response
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/family/:path*', '/admin/:path*'],
}
