import Fuse from 'fuse.js'
import { MATCH_STATUS } from './constants'

const TDS_RATES = [
  { section: '194C', rate: 0.02, keywords: ['contract', 'transport', 'freight', 'handling', 'outbound', 'inbound', 'lashing', 'stuffing', 'cartage', 'lcl', 'ground rent'] },
  { section: '194I', rate: 0.10, keywords: ['storage', 'warehouse', 'godown', 'rental', 'fixed storage', 'unit storage', 'cold storage'] },
  { section: '194J', rate: 0.10, keywords: ['professional', 'technical', 'consultancy', 'advisory', 'software', 'vas', 'value added'] },
  { section: '194H', rate: 0.05, keywords: ['commission', 'brokerage'] },
  { section: '194Q', rate: 0.001, keywords: ['purchase of goods'] },
]

const TIGHT_BAND = 0.003
const WIDE_BAND = 0.01

export interface TDSFXResult {
  tdsSection?: string
  tdsRate?: number
  tdsAmount?: number
  fxAmount?: number
  diffPct?: number
  classification: 'TDS_ONLY' | 'FX_ONLY' | 'TDS_AND_FX' | 'MISMATCH' | 'NONE'
}

export function classifyDifference(ourNet: number, partyNet: number, narration: string): TDSFXResult {
  const diff = ourNet - partyNet
  const diffPct = Math.abs(diff) / ourNet
  if (Math.abs(diff) < 0.5) {
    const result = { classification: 'NONE' as const }
    console.log('[TDS/FX]', { ourNet, partyNet, diffPct, section: undefined, classification: result.classification })
    return result
  }

  const narr = (narration || '').toLowerCase()
  const candidates = TDS_RATES
    .map(s => ({ ...s, distance: Math.abs(diffPct - s.rate) }))
    .filter(s => s.distance <= WIDE_BAND)
    .sort((a, b) => {
      const aKw = a.keywords.some(k => narr.includes(k))
      const bKw = b.keywords.some(k => narr.includes(k))
      if (aKw && !bKw) return -1
      if (bKw && !aKw) return 1
      return a.distance - b.distance
    })

  let result: TDSFXResult
  if (candidates.length === 0) {
    result = diffPct < 0.015
      ? { classification: 'FX_ONLY', fxAmount: diff, diffPct: diffPct * 100 }
      : { classification: 'MISMATCH', diffPct: diffPct * 100 }
  } else {
    const best = candidates[0]
    const theoreticalTDS = ourNet * best.rate
    if (best.distance <= TIGHT_BAND) {
      result = { classification: 'TDS_ONLY', tdsSection: best.section, tdsRate: best.rate, tdsAmount: theoreticalTDS, fxAmount: 0, diffPct: diffPct * 100 }
    } else {
      result = { classification: 'TDS_AND_FX', tdsSection: best.section, tdsRate: best.rate, tdsAmount: theoreticalTDS, fxAmount: diff - theoreticalTDS, diffPct: diffPct * 100 }
    }
  }
  // Temporary verification log requested by the specification.
  console.log('[TDS/FX]', { ourNet, partyNet, diffPct, section: result.tdsSection, classification: result.classification })
  return result
}

export function netByReference(rows: any[]) {
  const groups = new Map<string, { netAmount: number, narration: string, date: Date | null, rows: any[] }>()
  ;(rows ?? [])
    .filter(r => r.entryType === 'invoice' || r.entryType === 'credit_note')
    .forEach(r => {
      if (!r.refNo) return
      if (!groups.has(r.refNo)) groups.set(r.refNo, { netAmount: 0, narration: r.narration || '', date: r.date || null, rows: [] })
      const g = groups.get(r.refNo)!
      g.netAmount += r.entryType === 'credit_note' ? -Math.abs(r.amount) : Math.abs(r.amount)
      g.rows.push(r)
      if (!g.narration && r.narration) g.narration = r.narration
      if (!g.date && r.date) g.date = r.date
    })
  return groups
}

function statusFor(analysis: TDSFXResult, diff: number, fallback: string) {
  if (analysis.classification === 'TDS_ONLY') return `Possible TDS Deduction ${String.fromCharCode(0x2014)} ${analysis.tdsSection}`
  if (analysis.classification === 'TDS_AND_FX') return `Possible TDS + FX Difference ${String.fromCharCode(0x2014)} ${analysis.tdsSection}`
  if (analysis.classification === 'FX_ONLY') return 'Possible FX Difference (Exchange Gain/Loss)'
  if (analysis.classification === 'MISMATCH') return diff > 0 ? MATCH_STATUS.AMOUNT_MISMATCH_UNDER : MATCH_STATUS.AMOUNT_MISMATCH_OVER
  return fallback
}

function resultFor(our: any, party: any, analysis: TDSFXResult, status: string, matchType: string, remarks = '') {
  const difference = our.netAmount - party.netAmount
  return {
    refNo: our.refNo, rawRefNo: our.rows[0]?.rawRefNo, ourDate: our.date, ourAmount: our.netAmount,
    ourAmountUSD: Math.abs(our.rows[0]?.amountUSD || 0), ourCurrency: our.rows[0]?.detectedCurrency || 'INR',
    ourNarration: our.narration, partyDate: party.date, partyAmount: party.netAmount,
    partyCurrency: party.rows[0]?.detectedCurrency || 'INR', partyNarration: party.narration, difference,
    status, remarks, matchType, diffPct: analysis.diffPct || 0, tdsSection: analysis.tdsSection || '',
    tdsRate: analysis.tdsRate || 0, tdsAmount: analysis.tdsAmount || 0, fxAmount: analysis.fxAmount || 0,
    classification: analysis.classification,
  }
}

export function reconcileInvoices(ourRows: any[], partyRows: any[], _exchangeRate?: number) {
  const ourRaw = (ourRows ?? []).filter(r => r.entryType === 'invoice' || r.entryType === 'credit_note')
  const partyRaw = (partyRows ?? []).filter(r => r.entryType === 'invoice' || r.entryType === 'credit_note')
  const ourGroups = [...netByReference(ourRaw)].map(([refNo, value]) => ({ refNo, ...value }))
  const partyGroups = [...netByReference(partyRaw)].map(([refNo, value]) => ({ refNo, ...value }))
  const results: any[] = []
  const matchedOur = new Set<string>(), matchedParty = new Set<string>()

  const addMatch = (our: any, party: any, matchType: string, fallback: string, remarks = '') => {
    const analysis = classifyDifference(our.netAmount, party.netAmount, `${our.narration || ''} ${party.narration || ''}`)
    results.push(resultFor(our, party, analysis, statusFor(analysis, our.netAmount - party.netAmount, fallback), matchType, remarks))
    matchedOur.add(our.refNo); matchedParty.add(party.refNo)
  }

  ourGroups.forEach(our => {
    const party = partyGroups.find(p => p.refNo === our.refNo && !matchedParty.has(p.refNo))
    if (party) addMatch(our, party, 'exact', MATCH_STATUS.MATCHED)
  })

  const fuzzy = new Fuse(partyGroups.filter(p => !matchedParty.has(p.refNo)), { keys: ['refNo'], threshold: 0.2 })
  ourGroups.filter(o => !matchedOur.has(o.refNo)).forEach(our => {
    const hit = fuzzy.search(our.refNo)[0]?.item
    if (hit && Math.abs(our.netAmount - hit.netAmount) / (Math.abs(our.netAmount) || 1) < 0.05) addMatch(our, hit, 'fuzzy', MATCH_STATUS.POSSIBLE_TYPO, `Party ref: ${hit.rows[0]?.rawRefNo || hit.refNo}`)
  })

  ourGroups.filter(o => !matchedOur.has(o.refNo)).forEach(our => {
    const party = partyGroups.find(p => !matchedParty.has(p.refNo) && Math.abs(our.netAmount - p.netAmount) / (Math.abs(our.netAmount) || 1) < 0.01 && (!our.date || !p.date || Math.abs(new Date(our.date).getTime() - new Date(p.date).getTime()) / 86400000 <= 7))
    if (party) addMatch(our, party, 'amount_date', MATCH_STATUS.MATCHED_BY_AMOUNT_DATE)
  })

  ourRaw.filter(r => !r.refNo || !matchedOur.has(r.refNo)).forEach(r => results.push({ refNo: r.refNo || '(no ref)', rawRefNo: r.rawRefNo, ourDate: r.date, ourAmount: Math.abs(r.amount), ourAmountUSD: Math.abs(r.amountUSD || 0), ourCurrency: r.detectedCurrency || 'INR', ourNarration: r.narration, partyDate: null, partyAmount: 0, partyCurrency: 'INR', partyNarration: '', difference: Math.abs(r.amount), status: MATCH_STATUS.MISSING_IN_PARTY, remarks: '', matchType: 'missing' }))
  partyRaw.filter(r => !r.refNo || !matchedParty.has(r.refNo)).forEach(r => results.push({ refNo: r.refNo || '(no ref)', rawRefNo: r.rawRefNo, ourDate: null, ourAmount: 0, ourAmountUSD: 0, ourCurrency: 'INR', ourNarration: '', partyDate: r.date, partyAmount: Math.abs(r.amount), partyCurrency: r.detectedCurrency || 'INR', partyNarration: r.narration, difference: -Math.abs(r.amount), status: MATCH_STATUS.MISSING_IN_OURS, remarks: '', matchType: 'missing' }))
  return results
}

export function buildDetailedSummary(results: any[], ourRows: any[], partyRows: any[], ourOpeningBalance: any[], partyOpeningBalance: any[]) {
  const ourOB = (ourOpeningBalance ?? []).reduce((s, r) => s + r.amount, 0)
  const partyOB = (partyOpeningBalance ?? []).reduce((s, r) => s + r.amount, 0)
  const ourInvoiceTotal = (ourRows ?? []).filter(r => r.entryType === 'invoice').reduce((s, r) => s + r.amount, 0)
  const partyInvoiceTotal = (partyRows ?? []).filter(r => r.entryType === 'invoice').reduce((s, r) => s + r.amount, 0)
  const ourPaymentTotal = (ourRows ?? []).filter(r => r.entryType === 'payment').reduce((s, r) => s + Math.abs(r.amount), 0)
  const partyPaymentTotal = (partyRows ?? []).filter(r => r.entryType === 'payment').reduce((s, r) => s + Math.abs(r.amount), 0)
  const partyTDSTotal = (partyRows ?? []).filter(r => r.entryType === 'tds').reduce((s, r) => s + Math.abs(r.amount), 0)
  const ourNetBalance = ourOB + ourInvoiceTotal - ourPaymentTotal
  const partyNetBalance = partyOB + partyInvoiceTotal - partyPaymentTotal - partyTDSTotal
  const invoicesNotInParty = results.filter(r => r.status === MATCH_STATUS.MISSING_IN_PARTY).reduce((s, r) => s + r.ourAmount, 0)
  const invoicesNotInOurs = results.filter(r => r.status === MATCH_STATUS.MISSING_IN_OURS).reduce((s, r) => s + r.partyAmount, 0)
  const ourTDSTotal = (ourRows ?? []).filter(r => r.entryType === 'tds').reduce((s, r) => s + Math.abs(r.amount), 0)
  const partyTDSGap = Math.max(0, partyTDSTotal - ourTDSTotal)
  const tdsFromMismatch = results.filter(r => String(r.status).includes('TDS')).reduce((s, r) => s + (r.tdsAmount || 0), 0)
  const amountDifferences = results.filter(r => String(r.status).includes('Mismatch')).reduce((s, r) => s + Math.abs(r.difference), 0)
  const derivedBalance = partyNetBalance + invoicesNotInParty - invoicesNotInOurs + partyTDSGap + tdsFromMismatch - amountDifferences
  return { ourOB, partyOB, ourInvoiceTotal, partyInvoiceTotal, ourPaymentTotal, partyPaymentTotal, partyTDSTotal, tdsToBeBooked: partyTDSGap + tdsFromMismatch, tdsExplicitGap: partyTDSGap, tdsFromMismatch, ourNetBalance, partyNetBalance, invoicesNotInParty, invoicesNotInOurs, amountDifferences, derivedBalance, finalDifference: ourNetBalance - derivedBalance, matched: results.filter(r => r.status === MATCH_STATUS.MATCHED).length, tdsFlagged: results.filter(r => String(r.status).includes('TDS')).length, missingInParty: results.filter(r => r.status === MATCH_STATUS.MISSING_IN_PARTY).length, missingInOurs: results.filter(r => r.status === MATCH_STATUS.MISSING_IN_OURS).length, mismatch: results.filter(r => String(r.status).includes('Mismatch')).length, possible: results.filter(r => String(r.status).includes('Possible')).length, totalRows: results.length }
}
