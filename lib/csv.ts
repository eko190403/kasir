export function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value)
  const safeText = /^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replace(/"/g, '""')}"`
}
