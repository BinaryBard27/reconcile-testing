import { headerKey } from './utils'

export type DetectedFormat = 'TALLY' | 'SAP' | 'ZOHO' | 'GENERIC'

interface MappingSuggestion {
  refNo: string
  entryType: string
  date: string
  amountINR: string
  debitAmount: string
  creditAmount: string
  amountUSD: string
  narration: string
  utr: string
  clearedStatus: string
  docTypeColumn?: string
  amountLogic: 'separate' | 'signed' | 'doctype'
}

export function detectFormatAndSuggestMapping(headers: string[], rows: any[]): { format: DetectedFormat, suggestion: MappingSuggestion } {
  const normHeaders = headers.map(h => headerKey(h))
  const headerString = normHeaders.join(' ')

  let format: DetectedFormat = 'GENERIC'

  // Basic heuristic detection
  if (headerString.includes('vch type') || headerString.includes('voucher type') || headerString.includes('particulars')) {
    format = 'TALLY'
  } else if (headerString.includes('document type') || headerString.includes('doc type') || headerString.includes('assignment') || headerString.includes('clearing document')) {
    format = 'SAP'
  } else if (headerString.includes('zoho') || (headerString.includes('customer name') && headerString.includes('invoice status'))) {
    format = 'ZOHO'
  }

  // Find best matches for columns (generic, includes-based)
  const findHeader = (keywords: string[]) => {
    for (const kw of keywords) {
      const match = headers.find(h => headerKey(h).includes(kw))
      if (match) return match
    }
    return ''
  }

  // Exact header name match (normalized)
  const findExact = (target: string) => {
    return headers.find(h => headerKey(h) === headerKey(target)) || ''
  }

  const suggestion: MappingSuggestion = {
    refNo: findHeader(['vch no', 'invoice no', 'document no', 'assignment', 'ref no', 'ref']),
    entryType: findHeader(['vch type', 'document type', 'type', 'transaction type']),
    date: findHeader(['date', 'posting date', 'document date']),
    amountINR: '',
    debitAmount: '',
    creditAmount: '',
    amountUSD: '',
    narration: findHeader(['narration', 'particulars', 'text', 'description']),
    utr: findHeader(['utr', 'cheque', 'reference', 'payment ref']),
    clearedStatus: findHeader(['status', 'clearing', 'recon']),
    amountLogic: 'signed'
  }

  // Amount logic detection
  const hasDebit = findHeader(['debit', 'dr'])
  const hasCredit = findHeader(['credit', 'cr'])
  const hasAmount = findHeader(['amount', 'amt', 'value', 'balance'])

  if (hasDebit && hasCredit) {
    suggestion.debitAmount = hasDebit
    suggestion.creditAmount = hasCredit
    suggestion.amountLogic = 'separate'
  } else if (format === 'SAP' && suggestion.entryType) {
    // SAP: prioritize 'Company Code Currency Value' (exact match) before generic 'value'
    suggestion.amountINR =
      findExact('Company Code Currency Value') ||
      findHeader(['amount in local currency', 'loc.curr.amount']) ||
      hasAmount
    suggestion.docTypeColumn = suggestion.entryType
    suggestion.amountLogic = 'doctype'
  } else {
    suggestion.amountINR = hasAmount
    suggestion.amountLogic = 'signed'
  }

  // SAP-specific overrides: fix order of preference for several fields
  if (format === 'SAP') {
    // Date: prefer 'document date' over 'posting date' to avoid picking 'Posting Date' first
    suggestion.date =
      findExact('Document Date') ||
      findHeader(['document date']) ||
      findExact('Posting Date') ||
      findHeader(['posting date']) ||
      suggestion.date

    // Narration: exact match for 'text' BEFORE generic 'text' search, to avoid 'Document Header Text'
    // 'text' alone (exact) is the free-text line item description in SAP
    suggestion.narration =
      findExact('text') ||
      findHeader(['narration', 'particulars', 'description']) ||
      suggestion.narration

    // UTR: SAP stores bank UTR numbers in 'Document Header Text'
    suggestion.utr =
      findExact('Document Header Text') ||
      findHeader(['utr', 'cheque', 'payment ref']) ||
      suggestion.utr
  }

  return { format, suggestion }
}
