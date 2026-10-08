import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value
  let session = null
  
  if (sessionCookie) {
    try {
      session = await decrypt(sessionCookie)
    } catch (err) {
      session = null
    }
  }

  // Protect all routes except login, api routes, and static assets
  const path = request.nextUrl.pathname
  if (
    path.startsWith('/_next') || 
    path.startsWith('/api') || 
    path === '/login' ||
    path.includes('.')
  ) {
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based protection
  const user = session.user

  const managerOnlyRoutes = ['/settings', '/summary', '/staf', '/eod-report', '/riwayat']
  if (managerOnlyRoutes.some(route => path.startsWith(route)) && user.peran !== 'MANAJER') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const kitchenOnlyRoutes = ['/kitchen']
  if (kitchenOnlyRoutes.some(route => path.startsWith(route)) && !['DAPUR', 'MANAJER', 'KASIR'].includes(user.peran)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const menuManagementRoutes = ['/menu']
  if (menuManagementRoutes.some(route => path.startsWith(route)) && !['MANAJER', 'KASIR'].includes(user.peran)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const barOnlyRoutes = ['/bar']
  if (barOnlyRoutes.some(route => path.startsWith(route)) && !['BARTENDER', 'MANAJER', 'KASIR'].includes(user.peran)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
