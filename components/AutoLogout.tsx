'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { logout } from '@/app/actions'
import { toast } from 'sonner'

// 10 minutes in milliseconds
const IDLE_TIMEOUT = 10 * 60 * 1000

export default function AutoLogout() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Disable on login page
    if (pathname === '/login') return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        try {
          await logout()
          toast.warning('Sesi berakhir karena tidak ada aktivitas (idle 10 menit).')
          // router.push is handled by the redirect in logout() if it has one, 
          // or we can refresh to trigger middleware.
          window.location.href = '/login'
        } catch (e) {
          console.error(e)
        }
      }, IDLE_TIMEOUT)
    }

    // Attach event listeners for user activity
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      window.addEventListener(event, resetTimer)
    })

    // Start the timer initially
    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      events.forEach(event => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [pathname])

  return null
}
