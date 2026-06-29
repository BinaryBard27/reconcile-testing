import Fuse from 'fuse.js'
import { MATCH_STATUS } from './constants'

const TDS_SECTIONS = [
  {
    section: '194C',
    rate: 0.02,
    keywords: ['contract', 'transport', 'freight', 'handling', 'scanning',
               'logistics', 'lashing', 'stuffing', 'outbound', 'inbound',
               'cartage', 'delivery charges', 'lcl', 'port ssr',
               'transportation', 'ground rent'],
  },
  { section: '194C (Individual)', rate: 0.01, keywords: [] },
  {
    section: '194I',
    rate: 0.10,
    keywords: ['storage', 'warehouse', 'godown', 'space charges',
               'facility charges', 'cold storage', 'yard charges',
               'rental charges', 'fixed rental', 'unit storage',
               'fixed storage'],
  },
  {
    section: '194J',
    rate: 0.10,
    keywords: ['professional', 'technical', 'consultancy',
               'management fee', 'advisory', 'software', 'vas',
               'value added'],
  },
  { section: '194H', rate: 0.05, keywords: ['commission', 'brokerage', 'agency'] },
  { section: '194Q', rate: 0.001, keywords: ['purchase of goods'] },
]

export interface TDSFXResult {
  hasTDS: boolean
  tdsSection: string
  tdsRate: number
  tdsAmount: number
  hasFX: boolean
  fxAmount: number
  totalDiff: number
  diffPct: number
  classification: 'TDS_ONLY' | 'FX_ONLY' | 'TDS_AND_FX' | 'MISMATCH' | 'NONE'
}

export function classifyDifference(
  ourAmount: number,
  partyAmount: number,
  ourNarration: string,
  partyNarration: string,
  ourAmountUSD?: number,
  exchangeRate?: number
): TDSFXResult {
  
  const totalDiff = ourAmount - partyAmount
  if (Math.abs(totalDiff) < 0.5) {
    return {
      hasTDS: false, tdsSection: '', tdsRate: 0, tdsAmount: 0,
      hasFX: false, fxAmount: 0, totalDiff: 0, diffPct: 0,
      classification: 'NONE'
    }
  }

  const diffPct = Math.abs(totalDiff) / ourAmount

  // Narration for keyword matching
  const narr = ((ourNarration || '') + ' ' + (partyNarration || '')).toLowerCase()
  
  let searchDiff = totalDiff
  let fxFromRate = 0
  
  if (exchangeRate && ourAmountUSD && ourAmountUSD > 0) {
    const ourINRAtCurrentRate = ourAmountUSD * exchangeRate
    fxFromRate = Math.abs(ourAmount - ourINRAtCurrentRate)
    searchDiff = (totalDiff > 0 ? 1 : -1) * (Math.abs(totalDiff) - fxFromRate)
  }

  // Try each TDS section
  for (const section of TDS_SECTIONS) {
    const expectedTDS = ourAmount * section.rate
    const expectedTDSPct = section.rate
    
    // Check if narration matches this section's keywords
    const narrationMatch = section.keywords.length === 0 || 
      section.keywords.some(k => narr.includes(k))
    
    // Check if percentage difference matches TDS rate (within 0.5% tolerance)
    const pctMatchesTDS = Math.abs(diffPct - expectedTDSPct) < 0.005

    // Check if total diff ≈ expected TDS (within 5% of TDS amount)
    const amountMatchesTDS = Math.abs(Math.abs(searchDiff) - expectedTDS) < expectedTDS * 0.05

    if (pctMatchesTDS || amountMatchesTDS) {
      const actualTDS = Math.min(Math.abs(totalDiff), expectedTDS)
      const fxDiff = Math.abs(totalDiff) - actualTDS

      // FX difference is small residual (< 2% of invoice)
      let hasFX = Math.abs(fxDiff) > 0.5 && Math.abs(fxDiff) / ourAmount < 0.02
      let finalFxAmount = hasFX ? Math.round(fxDiff * 100) / 100 : 0
      
      if (fxFromRate > 0) {
        hasFX = true
        finalFxAmount = Math.round(fxFromRate * 100) / 100
      }

      return {
        hasTDS: true,
        tdsSection: section.section,
        tdsRate: section.rate,
        tdsAmount: Math.round(actualTDS * 100) / 100,
        hasFX,
        fxAmount: finalFxAmount,
        totalDiff: Math.round(totalDiff * 100) / 100,
        diffPct: Math.round(diffPct * 10000) / 100,
        classification: hasFX ? 'TDS_AND_FX' : 'TDS_ONLY'
      }
    }
  }

  // No TDS match found
  // Check if it's FX difference (small %, < 3%)
  if (diffPct < 0.03 || fxFromRate > 0) {
    let finalFxAmount = Math.round(Math.abs(totalDiff) * 100) / 100
    if (fxFromRate > 0 && Math.abs(searchDiff) < 0.5) {
       finalFxAmount = Math.round(fxFromRate * 100) / 100
    }

    return {
      hasTDS: false, tdsSection: '', tdsRate: 0, tdsAmount: 0,
      hasFX: true,
      fxAmount: finalFxAmount,
      totalDiff: Math.round(totalDiff * 100) / 100,
      diffPct: Math.round(diffPct * 10000) / 100,
      classification: 'FX_ONLY'
    }
  }

  // Large unexplained difference
  return {
    hasTDS: false, tdsSection: '', tdsRate: 0, tdsAmount: 0,
    hasFX: false, fxAmount: 0,
    totalDiff: Math.round(totalDiff * 100) / 100,
    diffPct: Math.round(diffPct * 10000) / 100,
    classification: 'MISMATCH'
  }
}

export function reconcileInvoices(ourRows: any[], partyRows: any[], exchangeRate?: number) {
  // Filter to invoices only
  const ourInvoices = (ourRows ?? []).filter((r) => r.entryType === 'invoice')
  const partyInvoices = (partyRows ?? []).filter((r) => r.entryType === 'invoice')

  const results: any[] = []
  const matchedPartyIndexes = new Set()

  // STEP 1: Exact ref match
  ourInvoices.forEach((ourRow) => {
    if (!ourRow.refNo) return

    const exactMatches = partyInvoices.filter(
      (p, idx) => p.refNo === ourRow.refNo && !matchedPartyIndexes.has(idx)
    )

    if (exactMatches.length > 0) {
      const party = exactMatches[0]
      const partyIdx = partyInvoices.indexOf(party)
      matchedPartyIndexes.add(partyIdx)

      const ourCurrency = ourRow.detectedCurrency || 'INR'
      const partyCurrency = party.detectedCurrency || 'INR'
      let currencyMismatch = ourCurrency !== partyCurrency

      let ourAmt = Math.abs(ourRow.amount)
      let partyAmt = Math.abs(party.amount)

      // Cross-currency matching using USD if available
      if (ourRow.amountUSD && partyCurrency === 'USD') {
        ourAmt = Math.abs(ourRow.amountUSD)
        currencyMismatch = false // Successfully resolved via USD amount
      } else if (party.amountUSD && ourCurrency === 'USD') {
        partyAmt = Math.abs(party.amountUSD)
        currencyMismatch = false // Successfully resolved via USD amount
      }

      const diff = ourAmt - partyAmt
      const pctDiff = ourAmt > 0 ? Math.abs(diff) / ourAmt : 0

      let status
      let matchData = {}

      if (currencyMismatch) {
        status = 'Currency Mismatch — verify exchange rate'
      } else {
        const analysis = classifyDifference(ourAmt, partyAmt, ourRow.narration, party.narration, ourRow.amountUSD, exchangeRate)

        if (analysis.classification === 'NONE') {
          status = MATCH_STATUS.MATCHED
        } else if (analysis.classification === 'TDS_ONLY') {
          status = `TDS Deduction — ${analysis.tdsSection}`
        } else if (analysis.classification === 'TDS_AND_FX') {
          status = `TDS + FX Difference — ${analysis.tdsSection}`
        } else if (analysis.classification === 'FX_ONLY') {
          status = 'FX Difference (Exchange Gain/Loss)'
        } else {
          status = diff > 0 
            ? MATCH_STATUS.AMOUNT_MISMATCH_UNDER 
            : MATCH_STATUS.AMOUNT_MISMATCH_OVER
        }
        
        matchData = {
          tdsSection: analysis.tdsSection,
          tdsRate: analysis.tdsRate,
          tdsAmount: analysis.tdsAmount,
          fxAmount: analysis.fxAmount,
          diffPct: analysis.diffPct,
          classification: analysis.classification
        }
      }

      results.push({
        refNo: ourRow.refNo,
        rawRefNo: ourRow.rawRefNo,
        ourDate: ourRow.date,
        ourAmount: ourAmt,
        ourAmountUSD: Math.abs(ourRow.amountUSD || 0),
        ourCurrency,
        ourNarration: ourRow.narration,
        partyDate: party.date,
        partyAmount: partyAmt,
        partyCurrency,
        partyNarration: party.narration,
        difference: currencyMismatch ? 0 : diff,
        status,
        remarks: currencyMismatch ? `Our: ${ourCurrency}, Party: ${partyCurrency}` : '',
        matchType: 'exact',
        ...matchData,
      })
    }
  })

  // STEP 2: Fuzzy match unmatched our invoices
  const unmatchedOur = ourInvoices.filter((r) => r.refNo && !results.find((res) => res.refNo === r.refNo))
  const unmatchedParty = partyInvoices.filter((_, idx) => !matchedPartyIndexes.has(idx))

  if (unmatchedOur.length > 0 && unmatchedParty.length > 0) {
    const fuse = new Fuse<any>(unmatchedParty, {
      keys: ['refNo'],
      threshold: 0.2, // tight — only very close matches
      includeScore: true,
    })

    unmatchedOur.forEach((ourRow) => {
      if (!ourRow.refNo) return
      const fuseResults = fuse.search(ourRow.refNo)

      if (fuseResults.length > 0) {
        const best = fuseResults[0]
        const party = best.item
        let ourAmt = Math.abs(ourRow.amount)
        let partyAmt = Math.abs(party.amount)
        const ourCurrency = ourRow.detectedCurrency || 'INR'
        const partyCurrency = party.detectedCurrency || 'INR'
        if (ourRow.amountUSD && partyCurrency === 'USD') {
          ourAmt = Math.abs(ourRow.amountUSD)
        } else if (party.amountUSD && ourCurrency === 'USD') {
          partyAmt = Math.abs(party.amountUSD)
        }
        
        const amountClose = Math.abs(ourAmt - partyAmt) / (ourAmt || 1) < 0.05 // within 5%

        if (amountClose) {
          matchedPartyIndexes.add(partyInvoices.indexOf(party))

          let status = MATCH_STATUS.POSSIBLE_TYPO
          let matchData = {}
          const analysis = classifyDifference(ourAmt, partyAmt, ourRow.narration, party.narration, ourRow.amountUSD, exchangeRate)
          
          if (analysis.classification !== 'NONE') {
            if (analysis.classification === 'TDS_ONLY') status = `TDS Deduction — ${analysis.tdsSection}`
            else if (analysis.classification === 'TDS_AND_FX') status = `TDS + FX Difference — ${analysis.tdsSection}`
            else if (analysis.classification === 'FX_ONLY') status = 'FX Difference (Exchange Gain/Loss)'
            else status = MATCH_STATUS.POSSIBLE_TYPO // Keep possible typo if just mismatch
            
            matchData = {
              tdsSection: analysis.tdsSection,
              tdsRate: analysis.tdsRate,
              tdsAmount: analysis.tdsAmount,
              fxAmount: analysis.fxAmount,
              diffPct: analysis.diffPct,
              classification: analysis.classification
            }
          }

          results.push({
            refNo: ourRow.refNo,
            rawRefNo: ourRow.rawRefNo,
            ourDate: ourRow.date,
            ourAmount: Math.abs(ourRow.amount),
            ourAmountUSD: Math.abs(ourRow.amountUSD || 0),
            ourCurrency: ourRow.detectedCurrency || 'INR',
            ourNarration: ourRow.narration,
            partyDate: party.date,
            partyAmount: Math.abs(party.amount),
            partyCurrency: party.detectedCurrency || 'INR',
            partyNarration: party.narration,
            difference: Math.abs(ourRow.amount) - Math.abs(party.amount),
            status,
            remarks: `Party ref: ${party.rawRefNo}`,
            matchType: 'fuzzy',
            ...matchData,
          })
        }
      }
    })
  }

  // STEP 3: Amount + date fallback for still-unmatched
  const stillUnmatchedOur = ourInvoices.filter(
    (r) => !results.find((res) => res.refNo === r.refNo && res.matchType !== 'missing')
  )
  const stillUnmatchedParty = partyInvoices.filter((_, idx) => !matchedPartyIndexes.has(idx))

  stillUnmatchedOur.forEach((ourRow) => {
    const amountDateMatch = stillUnmatchedParty.find((p) => {
      let ourAmt = Math.abs(ourRow.amount)
      let partyAmt = Math.abs(p.amount)
      
      const ourCurrency = ourRow.detectedCurrency || 'INR'
      const partyCurrency = p.detectedCurrency || 'INR'
      
      if (ourRow.amountUSD && partyCurrency === 'USD') {
        ourAmt = Math.abs(ourRow.amountUSD)
      } else if (p.amountUSD && ourCurrency === 'USD') {
        partyAmt = Math.abs(p.amountUSD)
      }

      const amountClose = Math.abs(ourAmt - partyAmt) / (ourAmt || 1) < 0.01
      if (!amountClose) return false
      if (!ourRow.date || !p.date) return amountClose
      const dayDiff = Math.abs(ourRow.date - p.date) / (1000 * 60 * 60 * 24)
      return dayDiff <= 7
    })

    if (amountDateMatch) {
      matchedPartyIndexes.add(partyInvoices.indexOf(amountDateMatch))
      let status = MATCH_STATUS.MATCHED_BY_AMOUNT_DATE
      let matchData = {}
      let ourAmt = Math.abs(ourRow.amount)
      let partyAmt = Math.abs(amountDateMatch.amount)
      const analysis = classifyDifference(ourAmt, partyAmt, ourRow.narration, amountDateMatch.narration, ourRow.amountUSD, exchangeRate)
      
      if (analysis.classification !== 'NONE') {
        if (analysis.classification === 'TDS_ONLY') status = `TDS Deduction — ${analysis.tdsSection}`
        else if (analysis.classification === 'TDS_AND_FX') status = `TDS + FX Difference — ${analysis.tdsSection}`
        else if (analysis.classification === 'FX_ONLY') status = 'FX Difference (Exchange Gain/Loss)'
        else status = MATCH_STATUS.MATCHED_BY_AMOUNT_DATE
        
        matchData = {
          tdsSection: analysis.tdsSection,
          tdsRate: analysis.tdsRate,
          tdsAmount: analysis.tdsAmount,
          fxAmount: analysis.fxAmount,
          diffPct: analysis.diffPct,
          classification: analysis.classification
        }
      }
      
      results.push({
        refNo: ourRow.refNo || '(no ref)',
        rawRefNo: ourRow.rawRefNo,
        ourDate: ourRow.date,
        ourAmount: Math.abs(ourRow.amount),
        ourAmountUSD: Math.abs(ourRow.amountUSD || 0),
        ourCurrency: ourRow.detectedCurrency || 'INR',
        ourNarration: ourRow.narration,
        partyDate: amountDateMatch.date,
        partyAmount: Math.abs(amountDateMatch.amount),
        partyCurrency: amountDateMatch.detectedCurrency || 'INR',
        partyNarration: amountDateMatch.narration,
        difference: ourAmt - partyAmt,
        status,
        remarks: `Our ref: ${ourRow.rawRefNo || 'none'} | Party ref: ${amountDateMatch.rawRefNo || 'none'}`,
        matchType: 'amount_date',
        ...matchData,
      })
    } else {
      results.push({
        refNo: ourRow.refNo || '(no ref)',
        rawRefNo: ourRow.rawRefNo,
        ourDate: ourRow.date,
        ourAmount: Math.abs(ourRow.amount),
        ourAmountUSD: Math.abs(ourRow.amountUSD || 0),
        ourCurrency: ourRow.detectedCurrency || 'INR',
        ourNarration: ourRow.narration,
        partyDate: null,
        partyAmount: 0,
        partyCurrency: 'INR',
        partyNarration: '',
        difference: Math.abs(ourRow.amount),
        status: MATCH_STATUS.MISSING_IN_PARTY,
        remarks: '',
        matchType: 'missing',
      })
    }
  })

  // STEP 4: Party invoices with no match in our books
  partyInvoices.forEach((p, idx) => {
    if (!matchedPartyIndexes.has(idx)) {
      results.push({
        refNo: p.refNo || '(no ref)',
        rawRefNo: p.rawRefNo,
        ourDate: null,
        ourAmount: 0,
        ourAmountUSD: 0,
        ourCurrency: 'INR',
        ourNarration: '',
        partyDate: p.date,
        partyAmount: Math.abs(p.amount),
        partyCurrency: p.detectedCurrency || 'INR',
        partyNarration: p.narration,
        difference: -Math.abs(p.amount),
        status: MATCH_STATUS.MISSING_IN_OURS,
        remarks: '',
        matchType: 'missing',
      })
    }
  })

  return results
}

export function buildDetailedSummary(
  results: any[],
  ourRows: any[],
  partyRows: any[],
  ourOpeningBalance: any[],
  partyOpeningBalance: any[]
) {
  // Opening balances
  const ourOB = ourOpeningBalance.reduce((s, r) => s + r.amount, 0)
  const partyOB = partyOpeningBalance.reduce((s, r) => s + r.amount, 0)

  // Invoice totals
  const ourInvoiceTotal = ourRows
    .filter(r => r.entryType === 'invoice').reduce((s, r) => s + r.amount, 0)
  const partyInvoiceTotal = partyRows
    .filter(r => r.entryType === 'invoice').reduce((s, r) => s + r.amount, 0)

  // Payment totals  
  const ourPaymentTotal = ourRows
    .filter(r => r.entryType === 'payment').reduce((s, r) => s + Math.abs(r.amount), 0)
  const partyPaymentTotal = partyRows
    .filter(r => r.entryType === 'payment').reduce((s, r) => s + Math.abs(r.amount), 0)

  // TDS totals
  const partyTDSTotal = partyRows
    .filter(r => r.entryType === 'tds').reduce((s, r) => s + Math.abs(r.amount), 0)

  // Net balances
  const ourNetBalance = ourOB + ourInvoiceTotal - ourPaymentTotal
  const partyNetBalance = partyOB + partyInvoiceTotal - partyPaymentTotal - partyTDSTotal

  // Reconciling items from results
  const invoicesNotInParty = results
    .filter(r => r.status === MATCH_STATUS.MISSING_IN_PARTY)
    .reduce((s, r) => s + r.ourAmount, 0)
  
  const invoicesNotInOurs = results
    .filter(r => r.status === MATCH_STATUS.MISSING_IN_OURS)
    .reduce((s, r) => s + r.partyAmount, 0)

  const ourTDSTotal = ourRows
    .filter(r => r.entryType === 'tds')
    .reduce((s, r) => s + Math.abs(r.amount), 0)


  const tdsExplicitGap = Math.max(0, partyTDSTotal - ourTDSTotal)

  const tdsFromMismatch = results
    .filter(r => String(r.status).startsWith('TDS Deduction'))
    .reduce((s, r) => s + (r.tdsAmount || 0), 0)

  const tdsToBeBooked = tdsFromMismatch + tdsExplicitGap

  const amountDifferences = results
    .filter(r => String(r.status).includes('Mismatch') && !String(r.status).startsWith('TDS'))
    .reduce((s, r) => s + Math.abs(r.difference), 0)

  // Derived balance (starting from party, adding adjustments to reach our balance)
  const derivedBalance = partyNetBalance
    + invoicesNotInParty
    - invoicesNotInOurs
    + tdsToBeBooked
    - amountDifferences

  const finalDifference = ourNetBalance - derivedBalance

  // Match counts
  const matched = results.filter(r => r.status === MATCH_STATUS.MATCHED).length
  const tdsFlagged = results.filter(r => String(r.status).startsWith('TDS')).length
  const missingInParty = results.filter(r => r.status === MATCH_STATUS.MISSING_IN_PARTY).length
  const missingInOurs = results.filter(r => r.status === MATCH_STATUS.MISSING_IN_OURS).length
  const mismatch = results.filter(r => String(r.status).includes('Mismatch')).length
  const possible = results.filter(r => String(r.status).includes('Possible')).length

  return {
    ourOB, partyOB,
    ourInvoiceTotal, partyInvoiceTotal,
    ourPaymentTotal, partyPaymentTotal,
    partyTDSTotal, tdsToBeBooked, tdsExplicitGap, tdsFromMismatch,
    ourNetBalance, partyNetBalance,
    invoicesNotInParty, invoicesNotInOurs,
    amountDifferences, derivedBalance,
    finalDifference,
    matched, tdsFlagged, missingInParty,
    missingInOurs, mismatch, possible,
    totalRows: results.length
  }
}
