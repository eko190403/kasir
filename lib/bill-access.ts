export function canAccessBill(
  role: string,
  userId: string,
  billKasirId: string | null,
  managerAuthorized = false
) {
  return role === "MANAJER" || managerAuthorized || billKasirId === userId
}
