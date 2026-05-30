import { headerKey } from './utils'

const SYNONYMS = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'voucher date'],
  amount: ['amount', 'amt', 'transaction amount', 'value', 'net amount', 'total', 'dr/cr', 'debit', 'credit'],
  description: ['narration', 'description', 'particulars', 'remarks', 'details', 'memo', 'notes'],
  reference: ['invoice', 'invoice no', 'invoice number', 'inv no', 'reference', 'ref', 'ref no', 'utr', 'cheque', 'chq', 'transaction id', 'txn id', 'vch no', 'voucher no'],
}

function scoreHeader(h, targets) {
  const hk = headerKey(h)
  if (!hk) return 0
  if (targets.includes(hk)) return 3
  for (const t of targets) {
    if (hk === t) return 3
    if (hk.includes(t)) return 2
  }
  return 0
}

export function guessMapping(headers) {
  const best = { date: '', amount: '', description: '', reference: '' }
  const bestScore = { date: 0, amount: 0, description: 0, reference: 0 }

  for (const h of headers ?? []) {
    for (const field of Object.keys(SYNONYMS)) {
      const s = scoreHeader(h, SYNONYMS[field])
      if (s > bestScore[field]) {
        best[field] = h
        bestScore[field] = s
      }
    }
  }

  return best
}

