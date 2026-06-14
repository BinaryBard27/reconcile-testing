import Fuse from 'fuse.js'
import { MATCH_STATUS } from './constants'

const TDS_SECTIONS = [
  { section: '194C', rate: 0.02, keywords: ['contract','transport','freight','handling','storage','scanning','logistics','warehouse','lashing','stuffing'] },
  { section: '194C (Individual)', rate: 0.01, keywords: [] },
  { section: '194J', rate: 0.10, keywords: ['professional','technical','consultancy','management fee','advisory','software'] },
  { section: '194H', rate: 0.05, keywords: ['commission','brokerage','agency'] },
  { section: '194Q', rate: 0.001, keywords: ['purchase of goods'] },
]

export function detectTDS(ourAmount: number, partyAmount: number, narration: string): {
  isTDS: boolean
  tdsSection: string
  tdsRate: number
  expectedTDS: number
  actualDeduction: number
} {
  const diff = ourAmount - partyAmount
  console.log('TDS check:', ourAmount, partyAmount, diff, 'sections tried:', TDS_SECTIONS.map(s => s.section + ':' + (ourAmount * s.rate).toFixed(2)))
  if (diff <= 0) return { isTDS: false, tdsSection: '', tdsRate: 0, expectedTDS: 0, actualDeduction: 0 }

  const narr = (narration || '').toLowerCase()
  
  // Try to detect section from narration keywords
  let detectedSection = TDS_SECTIONS[0] // default 194C
  for (const sec of TDS_SECTIONS) {
    if (sec.keywords.some(k => narr.includes(k))) {
      detectedSection = sec
      break
    }
  }

  // Check all sections if narration match fails
  for (const sec of TDS_SECTIONS) {
    const expectedTDS = ourAmount * sec.rate
    const tolerance = expectedTDS * 0.05 // 5% tolerance for rounding
    if (Math.abs(diff - expectedTDS) <= tolerance) {
      return {
        isTDS: true,
        tdsSection: sec.section,
        tdsRate: sec.rate,
        expectedTDS: Math.round(expectedTDS * 100) / 100,
        actualDeduction: Math.round(diff * 100) / 100
      }
    }
  }

  // Check detected section even if not exact match (within 10%)
  const expectedFromDetected = ourAmount * detectedSection.rate
  if (Math.abs(diff - expectedFromDetected) <= expectedFromDetected * 0.10) {
    return {
      isTDS: true,
      tdsSection: detectedSection.section + ' (approx)',
      tdsRate: detectedSection.rate,
      expectedTDS: Math.round(expectedFromDetected * 100) / 100,
      actualDeduction: Math.round(diff * 100) / 100
    }
  }

  return { isTDS: false, tdsSection: '', tdsRate: 0, expectedTDS: 0, actualDeduction: diff }
}

export function reconcileInvoices(ourRows, partyRows) {
  // Filter to invoices only
  const ourInvoices = (ourRows ?? []).filter((r) => r.entryType === 'invoice')
  const partyInvoices = (partyRows ?? []).filter((r) => r.entryType === 'invoice')

  const results = []
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
      const currencyMismatch = ourCurrency !== partyCurrency

      // Use INR amounts when currencies differ, direct amounts otherwise
      const ourAmt = Math.abs(ourRow.amount)
      const partyAmt = Math.abs(party.amount)

      const diff = ourAmt - partyAmt
      const pctDiff = ourAmt > 0 ? Math.abs(diff) / ourAmt : 0

      let status
      let tdsData = {}

      if (currencyMismatch) {
        status = 'Currency Mismatch — verify exchange rate'
      } else if (Math.abs(diff) < 0.5 || pctDiff < 0.001) {
        status = MATCH_STATUS.MATCHED
      } else if (diff > 0) {
        status = MATCH_STATUS.AMOUNT_MISMATCH_UNDER // party booked less
        const tds = detectTDS(ourAmt, partyAmt, ourRow.narration || party.narration)
        if (tds.isTDS) {
          status = `TDS Deduction — ${tds.tdsSection}`
          tdsData = {
            tdsSection: tds.tdsSection,
            tdsRate: tds.tdsRate,
            expectedTDS: tds.expectedTDS,
            actualDeduction: tds.actualDeduction
          }
        }
      } else {
        status = MATCH_STATUS.AMOUNT_MISMATCH_OVER // party booked more
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
        ...tdsData,
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
        const amountClose =
          Math.abs(Math.abs(ourRow.amount) - Math.abs(party.amount)) / (Math.abs(ourRow.amount) || 1) < 0.05 // within 5%

        if (amountClose) {
          matchedPartyIndexes.add(partyInvoices.indexOf(party))

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
            status: MATCH_STATUS.POSSIBLE_TYPO,
            remarks: `Party ref: ${party.rawRefNo}`,
            matchType: 'fuzzy',
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
      const amountClose = Math.abs(Math.abs(ourRow.amount) - Math.abs(p.amount)) / (Math.abs(ourRow.amount) || 1) < 0.01
      if (!amountClose) return false
      if (!ourRow.date || !p.date) return amountClose
      const dayDiff = Math.abs(ourRow.date - p.date) / (1000 * 60 * 60 * 24)
      return dayDiff <= 7
    })

    if (amountDateMatch) {
      matchedPartyIndexes.add(partyInvoices.indexOf(amountDateMatch))
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
        difference: 0,
        status: MATCH_STATUS.MATCHED_BY_AMOUNT_DATE,
        remarks: `Our ref: ${ourRow.rawRefNo || 'none'} | Party ref: ${amountDateMatch.rawRefNo || 'none'}`,
        matchType: 'amount_date',
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

  const tdsToBeBooked = results
    .filter(r => String(r.status).startsWith('TDS Deduction'))
    .reduce((s, r) => s + (r.actualDeduction || 0), 0)

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
    partyTDSTotal, tdsToBeBooked,
    ourNetBalance, partyNetBalance,
    invoicesNotInParty, invoicesNotInOurs,
    amountDifferences, derivedBalance,
    finalDifference,
    matched, tdsFlagged, missingInParty,
    missingInOurs, mismatch, possible,
    totalRows: results.length
  }
}
