import { formatISODate, normRef, normText, parseAmount, parseDate } from './utils'

export function normalizeRows(rows, mapping, options) {
  const {
    amountMode = 'as_is', // as_is | absolute | invert
  } = options ?? {}

  const mapped = []
  const safeRows = Array.isArray(rows) ? rows : []

  for (let i = 0; i < safeRows.length; i++) {
    const r = safeRows[i] ?? {}
    const dateObj = parseDate(mapping?.date ? r[mapping.date] : null)
    const date = formatISODate(dateObj)

    let amount = parseAmount(mapping?.amount ? r[mapping.amount] : 0)
    if (amountMode === 'absolute') amount = Math.abs(amount)
    if (amountMode === 'invert') amount = -amount

    const description = normText(mapping?.description ? r[mapping.description] : '')
    const referenceRaw = normText(mapping?.reference ? r[mapping.reference] : '')
    const reference = normRef(referenceRaw)

    // keep the row if it has at least something usable
    const hasSignal = Boolean(dateObj) || amount !== 0 || description || reference
    if (!hasSignal) continue

    mapped.push({
      id: `${i + 1}`,
      rowIndex: i,
      dateObj,
      date,
      amount,
      description,
      reference,
      referenceRaw,
      source: r,
    })
  }

  return mapped
}

