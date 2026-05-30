export function normalizeHeader(value) {
  return String(value ?? '').trim()
}

export function headerKey(value) {
  return normalizeHeader(value).toLowerCase().replace(/\s+/g, ' ').trim()
}

export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function excelSerialToDate(serial) {
  const base = new Date(Date.UTC(1899, 11, 30))
  return new Date(base.getTime() + Number(serial) * 24 * 60 * 60 * 1000)
}

export function parseDate(value) {
  if (!value && value !== 0) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = excelSerialToDate(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const raw = String(value).trim()
  if (!raw) return null
  const normalized = raw.replace(/\./g, '/').replace(/-/g, '/')

  // Try native parse first (handles ISO)
  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) return parsed

  // dd/mm/yyyy (common in India statements)
  const m = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2]) - 1
  const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
  const d = new Date(year, month, day)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatISODate(dateObj) {
  if (!dateObj) return ''
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function diffDays(dateA, dateB) {
  if (!dateA || !dateB) return Infinity
  const a = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate())
  const b = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate())
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)
}

export function normText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normRef(value) {
  return normText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function clamp01(n) {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

