export type ManagerLockState = {
  id: string
  failedAttempts: number
  lockedUntil?: Date | null
}

export function selectTargetManagerForFailedPinAttempt(
  managers: ManagerLockState[],
  now: Date = new Date()
): string | null {
  const activeManagers = managers.filter((manager) => !manager.lockedUntil || now >= manager.lockedUntil)
  if (activeManagers.length === 0) return null

  return [...activeManagers]
    .sort((a, b) => b.failedAttempts - a.failedAttempts || a.id.localeCompare(b.id))[0]?.id ?? null
}
