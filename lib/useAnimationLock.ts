import { useRef, useCallback } from 'react'

export function useAnimationLock(duration = 400) {
  const lockRef = useRef(false)

  const withLock = useCallback(
    <T,>(fn: (...args: T[]) => void) => {
      return (...args: T[]) => {
        if (lockRef.current) return
        lockRef.current = true
        fn(...args)
        setTimeout(() => {
          lockRef.current = false
        }, duration)
      }
    },
    [duration]
  )

  const withLockNoArgs = useCallback(
    <R,>(fn: () => R) => {
      return () => {
        if (lockRef.current) return undefined as R
        lockRef.current = true
        try {
          return fn()
        } finally {
          setTimeout(() => {
            lockRef.current = false
          }, duration)
        }
      }
    },
    [duration]
  )

  const isLocked = useCallback(() => lockRef.current, [])

  return { withLock, withLockNoArgs, isLocked }
}
