import { headerKey } from './utils'

export type DetectedFormat = 'TALLY' | 'SAP' | 'ZOHO' | 'CUSTOM' | 'GENERIC' | (string & {})

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
  amountLogic: 'separate' | 'doctype'
}

function isParseableDate(val: unknown): boolean {
  if (!val) return false
  if (val instanceof Date) return !isNaN(val.getTime())
  const s = String(val).trim()
  if (!s) return false
  // ISO
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true
  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s)) return true
  // Excel serial
  const n = parseFloat(s)
  if (!isNaN(n) && n > 40000 && n < 60000) return true
  const d = new Date(s)
  return !isNaN(d.getTime())
}

function isNumericValue(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false
  if (typeof val === 'number') return Number.isFinite(val)
  const cleaned = String(val).replace(/,/g, '').trim()
  return cleaned !== '' && !isNaN(Number(cleaned))
}

function isAlphanumericRef(val: unknown): boolean {
  const s = String(val ?? '').trim()
  return s.length > 0 && /^[a-zA-Z0-9\-_/\\. ]+$/.test(s)
}

function contentBasedDetection(headers: string[], rows: any[]): MappingSuggestion {
  const suggestion: MappingSuggestion = {
    refNo: '', entryType: '', date: '', amountINR: '',
    debitAmount: '', creditAmount: '', amountUSD: '',
    narration: '', utr: '', clearedStatus: '', amountLogic: 'separate'
  }

  if (!rows.length || !headers.length) return suggestion

  const sampleSize = Math.min(rows.length, 50)
  const sample = rows.slice(0, sampleSize)

  const colAnalysis: Record<string, {
    uniqueValues: Set<string>
    dateCount: number
    numericCount: number
    alphanumericCount: number
    nonEmpty: number
    avgLength: number
  }> = {}

  for (const h of headers) {
    const vals = sample.map(r => r?.[h])
    const nonEmpty = vals.filter(v => v !== null && v !== undefined && String(v).trim() !== '')
    const uniqueSet = new Set(nonEmpty.map(v => String(v).trim()))
    const dateCount = nonEmpty.filter(v => isParseableDate(v)).length
    const numericCount = nonEmpty.filter(v => isNumericValue(v)).length
    const alphanumericCount = nonEmpty.filter(v => isAlphanumericRef(v)).length
    const avgLength = nonEmpty.length > 0
      ? nonEmpty.reduce((s, v) => s + String(v).length, 0) / nonEmpty.length
      : 0

    colAnalysis[h] = {
      uniqueValues: uniqueSet,
      dateCount,
      numericCount,
      alphanumericCount,
      nonEmpty: nonEmpty.length,
      avgLength
    }
  }

  // Find entry type column: 2-8 unique values
  for (const h of headers) {
    const a = colAnalysis[h]
    if (a.uniqueValues.size >= 2 && a.uniqueValues.size <= 8 && a.nonEmpty > sampleSize * 0.5) {
      if (!suggestion.entryType) suggestion.entryType = h
    }
  }

  // Find reference number: >80% unique alphanumeric
  for (const h of headers) {
    const a = colAnalysis[h]
    if (a.nonEmpty > 0 && a.alphanumericCount / a.nonEmpty > 0.8 && a.uniqueValues.size / a.nonEmpty > 0.8) {
      if (h !== suggestion.entryType && !suggestion.refNo) suggestion.refNo = h
    }
  }

  // Find date column: >80% parseable dates
  for (const h of headers) {
    const a = colAnalysis[h]
    if (a.nonEmpty > 0 && a.dateCount / a.nonEmpty > 0.8) {
      if (!suggestion.date) suggestion.date = h
    }
  }

  // Find amount columns: >90% numeric
  const numericCols: string[] = []
  for (const h of headers) {
    const a = colAnalysis[h]
    if (a.nonEmpty > 0 && a.numericCount / a.nonEmpty > 0.9) {
      if (h !== suggestion.date && h !== suggestion.refNo && h !== suggestion.entryType) {
        numericCols.push(h)
      }
    }
  }

  // Check for debit/credit by header name
  const debitCol = numericCols.find(h => /debit|dr/i.test(h))
  const creditCol = numericCols.find(h => /credit|cr/i.test(h))
  if (debitCol && creditCol) {
    suggestion.debitAmount = debitCol
    suggestion.creditAmount = creditCol
    suggestion.amountLogic = 'separate'
  } else if (numericCols.length >= 2) {
    suggestion.debitAmount = numericCols[0]
    suggestion.creditAmount = numericCols[1]
    suggestion.amountLogic = 'separate'
  } else if (numericCols.length === 1) {
    suggestion.amountINR = numericCols[0]
    suggestion.amountLogic = 'separate'
  }

  // Find narration: longest average text, non-numeric, non-date
  let bestNarr = ''
  let bestNarrLen = 0
  for (const h of headers) {
    const a = colAnalysis[h]
    if (h === suggestion.refNo || h === suggestion.date || h === suggestion.entryType) continue
    if (numericCols.includes(h)) continue
    if (a.avgLength > bestNarrLen && a.nonEmpty > sampleSize * 0.3) {
      bestNarrLen = a.avgLength
      bestNarr = h
    }
  }
  suggestion.narration = bestNarr

  return suggestion
}

function findCrossReferenceColumn(
  headers: string[],
  rows: any[],
  currentRefNo: string
): string | null {
  const crossRefKeywords = [
    'ref no', 'reference no', 'supplier invoice', 'vendor invoice',
    'party invoice', 'invoice no', 'our ref', 'cross ref', 'invoice',
  ]

  const candidates = headers.filter(h => {
    const hk = h.toLowerCase().replace(/\s+/g, ' ').trim()
    return crossRefKeywords.some(k => hk.includes(k)) && h !== currentRefNo
  })

  for (const col of candidates) {
    const sampleVals = rows.slice(0, 20)
      .map(r => String(r?.[col] ?? '').trim())
      .filter(Boolean)
    const hasLongNumericRefs = sampleVals
      .filter(v => /^\d{9,}$/.test(v.replace(/\.0+$/, ''))).length
    if (hasLongNumericRefs > sampleVals.length * 0.3) {
      return col
    }
  }
  return null
}

export function detectFormatAndSuggestMapping(headers: string[], rows: any[]): { format: DetectedFormat, suggestion: MappingSuggestion } {
  const normHeaders = headers.map(h => headerKey(h))
  const headerString = normHeaders.join(' ')

  let format: DetectedFormat = 'GENERIC'

  // Tally-specific detection
  if (headerString.includes('vch no') || headerString.includes('vch type') || headerString.includes('particulars')) {
    format = 'TALLY'
  } else if (headerString.includes('voucher type') && headerString.includes('supplier invoice no')) {
    format = 'ZOHO'
  } else if (headerString.includes('document type') || headerString.includes('doc type') || headerString.includes('company code') || headerString.includes('assignment') || headerString.includes('clearing document')) {
    format = 'SAP'
  } else if (headerString.includes('zoho') || (headerString.includes('customer name') && headerString.includes('invoice status'))) {
    format = 'ZOHO'
  } else if (headerString.includes('voucher type')) {
    format = 'TALLY'
  }

  // If no known format, try content-based detection
  if (format === 'GENERIC') {
    format = 'CUSTOM'
    const contentSuggestion = contentBasedDetection(headers, rows)
    // Still try header-keyword detection as primary
    const findHeader = (keywords: string[]) => {
      for (const kw of keywords) {
        const match = headers.find(h => headerKey(h).includes(kw))
        if (match) return match
      }
      return ''
    }

    const refNo = findHeader(['invoice no', 'document no', 'ref no', 'ref', 'number'])
    const entryType = findHeader(['type', 'transaction type'])
    const date = findHeader(['date'])
    const narration = findHeader(['narration', 'particulars', 'text', 'description', 'memo', 'notes'])
    const utr = findHeader(['utr', 'cheque', 'payment ref', 'reference'])

    const customSuggestion: MappingSuggestion = {
      refNo: refNo || contentSuggestion.refNo,
      entryType: entryType || contentSuggestion.entryType,
      date: date || contentSuggestion.date,
      amountINR: contentSuggestion.amountINR,
      debitAmount: contentSuggestion.debitAmount,
      creditAmount: contentSuggestion.creditAmount,
      amountUSD: contentSuggestion.amountUSD,
      narration: narration || contentSuggestion.narration,
      utr: utr || contentSuggestion.utr,
      clearedStatus: contentSuggestion.clearedStatus,
      amountLogic: contentSuggestion.amountLogic,
    }

    let customLabel: DetectedFormat = 'CUSTOM'
    const betterRef = findCrossReferenceColumn(headers, rows, customSuggestion.refNo)
    if (betterRef) {
      customSuggestion.refNo = betterRef
      customLabel = `Auto-detected: CUSTOM Format — using "${betterRef}" as reference key` as DetectedFormat
    }

    return {
      format: customLabel,
      suggestion: customSuggestion,
    }
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
    amountLogic: 'separate'
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
    suggestion.amountLogic = 'separate'
  }

  // SAP-specific overrides: fix order of preference for several fields
  if (format === 'SAP') {
    const sapRef = headers.find(h => headerKey(h) === 'reference')
    suggestion.refNo = sapRef || 
      headers.find(h => headerKey(h).includes('ref no')) || 
      findHeader(['reference', 'ref'])

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

  // Validation step for header-based matches
  let finalFormat = format as string
  if (format === 'TALLY' || format === 'SAP' || format === 'ZOHO') {
    const formatName = format === 'SAP' ? 'SAP' : format === 'TALLY' ? 'Tally' : 'Zoho'
    finalFormat = `Auto-detected: ${formatName} Format`

    const sampleSize = Math.min(rows.length, 20)
    const sample = rows.slice(0, sampleSize)
    let contentSuggestion: MappingSuggestion | null = null

    const fieldsToCheck: (keyof MappingSuggestion)[] = [
      'refNo', 'entryType', 'date', 'amountINR', 'debitAmount', 'creditAmount',
    ]

    for (const colName of fieldsToCheck) {
      const field = suggestion[colName] as string
      if (!field) continue

      let emptyCount = 0
      for (const row of sample) {
        const val = row[field]
        if (val === null || val === undefined || String(val).trim() === '') {
          emptyCount++
        }
      }

      if (sampleSize > 0 && emptyCount / sampleSize > 0.7) {
        if (!contentSuggestion) {
          contentSuggestion = contentBasedDetection(headers, rows)
        }
        ;(suggestion as any)[colName] = contentSuggestion[colName]
      }
    }
  }

  // Only run cross-reference override for non-SAP formats
  if (format !== 'SAP') {
    const betterRef = findCrossReferenceColumn(headers, rows, suggestion.refNo)
    if (betterRef) {
      suggestion.refNo = betterRef
      if (format === 'TALLY' || format === 'ZOHO') {
        const formatName = format === 'TALLY' ? 'Tally' : 'Zoho'
        finalFormat = `Auto-detected: ${formatName} Format — using "${betterRef}" as reference key`
      }
    }
  }

  return { format: finalFormat as DetectedFormat, suggestion }
}
