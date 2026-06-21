import { headerKey } from './utils'

export type DetectedFormat = 'TALLY' | 'SAP' | 'ZOHO' | 'CUSTOM' | 'GENERIC' | 'ASCENDAS' | 'AP_AR' | (string & {})

export interface ColumnScore {
  columnName: string
  score: number
  reason: string
}

export interface MappingDiagnostics {
  refNoCandidates: ColumnScore[]
  dateCandidates: ColumnScore[]
  amountCandidates: ColumnScore[]
  entryTypeCandidates: ColumnScore[]
  confidenceScore: number
  isConfidenceLow: boolean
}

export interface MappingSuggestion {
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
  if (!s || s.length < 5) return false
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s)) return true
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
  // At least one number, some length
  return s.length >= 3 && /^[a-zA-Z0-9\-_/\\. ]+$/.test(s) && /\d/.test(s)
}

function analyzeColumn(headers: string[], rows: any[], targetHeader: string) {
  const sampleSize = Math.min(rows.length, 50)
  const sample = rows.slice(0, sampleSize)
  
  const vals = sample.map(r => r?.[targetHeader])
  const nonEmpty = vals.filter(v => v !== null && v !== undefined && String(v).trim() !== '')
  const uniqueSet = new Set(nonEmpty.map(v => String(v).trim()))
  
  const dateCount = nonEmpty.filter(v => isParseableDate(v)).length
  const numericCount = nonEmpty.filter(v => isNumericValue(v)).length
  const alphanumericCount = nonEmpty.filter(v => isAlphanumericRef(v)).length
  
  return {
    nonEmptyCount: nonEmpty.length,
    uniqueCount: uniqueSet.size,
    dateCount,
    numericCount,
    alphanumericCount,
    sampleSize
  }
}

function scoreColumn(
  header: string, 
  type: 'refNo' | 'date' | 'amount' | 'entryType', 
  analysis: ReturnType<typeof analyzeColumn>
): ColumnScore {
  let headerScore = 0
  let contentScore = 0
  let reasonParts: string[] = []
  
  const hk = headerKey(header)
  
  const hasData = analysis.nonEmptyCount > 0
  const fillRate = hasData ? analysis.nonEmptyCount / analysis.sampleSize : 0

  if (type === 'refNo') {
    if (hk === 'reference' || hk === 'ref no' || hk === 'invoice no' || hk === 'document no' || hk === 'vch no' || hk === 'voucher no') {
      headerScore = 1.0
      reasonParts.push(`Exact header match (${header})`)
    } else if (hk.includes('ref') || hk.includes('inv') || hk.includes('doc')) {
      headerScore = 0.5
      reasonParts.push(`Partial header match (${header})`)
    }

    if (hasData) {
      const alphaRate = analysis.alphanumericCount / analysis.nonEmptyCount
      const uniqueness = analysis.uniqueCount / analysis.nonEmptyCount
      contentScore = (alphaRate * 0.5) + (uniqueness * 0.5)
      reasonParts.push(`${Math.round(alphaRate*100)}% valid refs, ${Math.round(uniqueness*100)}% uniqueness`)
    }
  } 
  else if (type === 'date') {
    if (hk === 'date' || hk === 'document date' || hk === 'posting date' || hk === 'payment date' || hk === 'invoice dt') {
      headerScore = 1.0
      reasonParts.push(`Exact header match (${header})`)
    } else if (hk.includes('date') || hk.includes('dt')) {
      headerScore = 0.6
      reasonParts.push(`Partial header match (${header})`)
    }

    if (hasData) {
      const dateRate = analysis.dateCount / analysis.nonEmptyCount
      contentScore = dateRate
      reasonParts.push(`${Math.round(dateRate*100)}% parseable dates`)
    }
  }
  else if (type === 'amount') {
    if (hk === 'amount' || hk === 'value' || hk === 'balance' || hk === 'company code currency value' || hk === 'loc.curr.amount') {
      headerScore = 1.0
      reasonParts.push(`Exact header match (${header})`)
    } else if (hk.includes('amt') || hk.includes('amount') || hk.includes('debit') || hk.includes('credit')) {
      headerScore = 0.6
      reasonParts.push(`Partial header match (${header})`)
    }

    if (hasData) {
      const numRate = analysis.numericCount / analysis.nonEmptyCount
      contentScore = numRate
      reasonParts.push(`${Math.round(numRate*100)}% numeric`)
    }
  }
  else if (type === 'entryType') {
    if (hk === 'type' || hk === 'document type' || hk === 'vch type' || hk === 'transaction type' || hk === 'series') {
      headerScore = 1.0
      reasonParts.push(`Exact header match (${header})`)
    } else if (hk.includes('type')) {
      headerScore = 0.5
      reasonParts.push(`Partial header match (${header})`)
    }

    if (hasData && analysis.nonEmptyCount > 10) {
      const isDateCol = analysis.dateCount / analysis.nonEmptyCount > 0.8
      const isNumCol = analysis.numericCount / analysis.nonEmptyCount > 0.8
      
      if (isDateCol || isNumCol) {
        contentScore = 0.0
        reasonParts.push(`Penalized: Primarily dates or numbers`)
      } else if (analysis.uniqueCount >= 2 && analysis.uniqueCount <= 15) {
        contentScore = 1.0
        reasonParts.push(`${analysis.uniqueCount} categorical unique values`)
      } else {
        contentScore = 0.0
        reasonParts.push(`Too many or too few unique values (${analysis.uniqueCount})`)
      }
    } else if (hasData && analysis.uniqueCount > 0) {
       contentScore = 0.5
       reasonParts.push(`Sparse but has ${analysis.uniqueCount} categorical values`)
    }
  }

  // Weight header and content heavily based on presence
  let totalScore = 0
  if (hasData) {
    totalScore = (headerScore * 0.4) + (contentScore * 0.4) + (fillRate * 0.2)
  } else {
    // If no data, rely purely on header but penalize
    totalScore = headerScore * 0.3
    reasonParts.push('Column is completely empty')
  }

  return {
    columnName: header,
    score: totalScore,
    reason: reasonParts.join(' | ')
  }
}

export function detectFormatAndSuggestMapping(headers: string[], rows: any[]): { 
  format: DetectedFormat, 
  suggestion: MappingSuggestion,
  diagnostics: MappingDiagnostics 
} {
  const normHeaders = headers.map(h => headerKey(h))
  const headerString = normHeaders.join(' ')

  let format: DetectedFormat = 'GENERIC'

  // Advanced format detection
  if (headerString.includes('document type') && (headerString.includes('company code') || headerString.includes('assignment') || headerString.includes('clearing document'))) {
    format = 'SAP'
  } else if (headerString.includes('vch no') && headerString.includes('vch type') && headerString.includes('particulars')) {
    format = 'TALLY'
  } else if (headerString.includes('invoice no') && headerString.includes('payment date') && headerString.includes('credit')) {
    format = 'ASCENDAS'
  } else if (headerString.includes('document no') && headerString.includes('due date') && headerString.includes('balance')) {
    format = 'AP_AR'
  } else if (headerString.includes('voucher type') && headerString.includes('supplier invoice no')) {
    format = 'ZOHO'
  } else if (headerString.includes('zoho') || (headerString.includes('customer name') && headerString.includes('invoice status'))) {
    format = 'ZOHO'
  }

  const diagnostics: MappingDiagnostics = {
    refNoCandidates: [],
    dateCandidates: [],
    amountCandidates: [],
    entryTypeCandidates: [],
    confidenceScore: 0,
    isConfidenceLow: true
  }

  // Pre-compute analysis for all columns
  const columnAnalysis: Record<string, ReturnType<typeof analyzeColumn>> = {}
  for (const h of headers) {
    columnAnalysis[h] = analyzeColumn(headers, rows, h)
  }

  // Score all columns
  for (const h of headers) {
    diagnostics.refNoCandidates.push(scoreColumn(h, 'refNo', columnAnalysis[h]))
    diagnostics.dateCandidates.push(scoreColumn(h, 'date', columnAnalysis[h]))
    diagnostics.amountCandidates.push(scoreColumn(h, 'amount', columnAnalysis[h]))
    diagnostics.entryTypeCandidates.push(scoreColumn(h, 'entryType', columnAnalysis[h]))
  }

  // Sort descending by score
  diagnostics.refNoCandidates.sort((a, b) => b.score - a.score)
  diagnostics.dateCandidates.sort((a, b) => b.score - a.score)
  diagnostics.amountCandidates.sort((a, b) => b.score - a.score)
  diagnostics.entryTypeCandidates.sort((a, b) => b.score - a.score)

  // Keep top 20
  diagnostics.refNoCandidates = diagnostics.refNoCandidates.slice(0, 20)
  diagnostics.dateCandidates = diagnostics.dateCandidates.slice(0, 20)
  diagnostics.amountCandidates = diagnostics.amountCandidates.slice(0, 20)
  diagnostics.entryTypeCandidates = diagnostics.entryTypeCandidates.slice(0, 20)

  const topEntry = diagnostics.entryTypeCandidates[0]
  // Only auto-map entry type if it has a good score AND either matches the header or is an explicit SAP/TALLY format
  let entryTypeCol = ''
  if (topEntry && topEntry.score > 0.4) {
    if (format === 'SAP' || format === 'TALLY' || topEntry.reason.includes('match')) {
      entryTypeCol = topEntry.columnName
    }
  }

  const suggestion: MappingSuggestion = {
    refNo: diagnostics.refNoCandidates[0]?.columnName || '',
    date: diagnostics.dateCandidates[0]?.columnName || '',
    entryType: entryTypeCol,
    amountINR: '',
    debitAmount: '',
    creditAmount: '',
    amountUSD: '',
    narration: '',
    utr: '',
    clearedStatus: '',
    amountLogic: 'separate'
  }

  // Amount logic (debit/credit vs single column)
  const debitCol = diagnostics.amountCandidates.find(c => headerKey(c.columnName).includes('debit') || headerKey(c.columnName) === 'dr')?.columnName
  const creditCol = diagnostics.amountCandidates.find(c => c.columnName !== debitCol && (headerKey(c.columnName).includes('credit') || headerKey(c.columnName) === 'cr'))?.columnName

  if (format === 'SAP') {
    const sapAmt = headers.find(h => headerKey(h) === 'company code currency value') || diagnostics.amountCandidates[0]?.columnName
    suggestion.amountINR = sapAmt || ''
    suggestion.docTypeColumn = suggestion.entryType
    suggestion.amountLogic = 'doctype'
  } else if (debitCol && creditCol) {
    suggestion.debitAmount = debitCol
    suggestion.creditAmount = creditCol
    suggestion.amountLogic = 'separate'
  } else {
    suggestion.amountINR = diagnostics.amountCandidates[0]?.columnName || ''
    suggestion.amountLogic = 'separate'
  }

  // Format specific overrides
  if (format === 'SAP') {
    const sapRefExact = headers.find(h => 
      h.toLowerCase().replace(/\s+/g,'') === 'reference'
    )
    suggestion.refNo = sapRefExact || ''
    const docCurrencyValue = headers.find(h => headerKey(h) === 'document currency value' || headerKey(h) === 'amount in doc. curr.')
    if (docCurrencyValue) {
      suggestion.amountUSD = docCurrencyValue
    }
  } else if (format === 'ASCENDAS') {
    const invoiceNo = headers.find(h => headerKey(h) === 'invoice no')
    if (invoiceNo) suggestion.refNo = invoiceNo
    const invoiceDt = headers.find(h => headerKey(h) === 'invoice dt')
    if (invoiceDt) suggestion.date = invoiceDt
  }

  // Calculate overall confidence
  const topScores = [
    diagnostics.refNoCandidates[0]?.score || 0,
    diagnostics.dateCandidates[0]?.score || 0,
    diagnostics.amountCandidates[0]?.score || 0
  ]
  const avgConfidence = topScores.reduce((a, b) => a + b, 0) / 3
  diagnostics.confidenceScore = avgConfidence
  diagnostics.isConfidenceLow = avgConfidence < 0.55

  // Determine final format label
  let finalFormatStr = format as string
  if (format === 'SAP') finalFormatStr = 'Auto-detected: SAP Format'
  else if (format === 'TALLY') finalFormatStr = 'Auto-detected: Tally Format'
  else if (format === 'ZOHO') finalFormatStr = 'Auto-detected: Zoho Format'
  else if (format === 'ASCENDAS') finalFormatStr = 'Auto-detected: Ascendas AP Statement'
  else if (format === 'AP_AR') finalFormatStr = 'Auto-detected: AP/AR Statement'
  else if (format === 'CUSTOM' || format === 'GENERIC') finalFormatStr = 'Auto-detected: Custom/Generic Format'

  return { 
    format: finalFormatStr as DetectedFormat, 
    suggestion, 
    diagnostics 
  }
}
