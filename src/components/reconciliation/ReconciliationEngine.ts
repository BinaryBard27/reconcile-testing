import Fuse from 'fuse.js'
import { MATCH_STATUS } from './constants'

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

      const diff = Math.abs(ourRow.amount) - Math.abs(party.amount)
      const pctDiff = ourRow.amount > 0 ? Math.abs(diff) / Math.abs(ourRow.amount) : 0

      let status
      if (Math.abs(diff) < 0.5 || pctDiff < 0.001) {
        status = MATCH_STATUS.MATCHED
      } else if (diff > 0) {
        status = MATCH_STATUS.AMOUNT_MISMATCH_UNDER // party booked less
      } else {
        status = MATCH_STATUS.AMOUNT_MISMATCH_OVER // party booked more
      }

      results.push({
        refNo: ourRow.refNo,
        rawRefNo: ourRow.rawRefNo,
        ourDate: ourRow.date,
        ourAmount: Math.abs(ourRow.amount),
        ourAmountUSD: Math.abs(ourRow.amountUSD),
        ourNarration: ourRow.narration,
        partyDate: party.date,
        partyAmount: Math.abs(party.amount),
        partyNarration: party.narration,
        difference: diff,
        status,
        remarks: '',
        matchType: 'exact',
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
            ourAmountUSD: Math.abs(ourRow.amountUSD),
            ourNarration: ourRow.narration,
            partyDate: party.date,
            partyAmount: Math.abs(party.amount),
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
        ourAmountUSD: Math.abs(ourRow.amountUSD),
        ourNarration: ourRow.narration,
        partyDate: amountDateMatch.date,
        partyAmount: Math.abs(amountDateMatch.amount),
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
        ourAmountUSD: Math.abs(ourRow.amountUSD),
        ourNarration: ourRow.narration,
        partyDate: null,
        partyAmount: 0,
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
        ourNarration: '',
        partyDate: p.date,
        partyAmount: Math.abs(p.amount),
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

export function buildSummary(results, ourRows, partyRows) {
  const ourTotal = (ourRows ?? [])
    .filter((r) => r.entryType === 'invoice')
    .reduce((s, r) => s + Math.abs(r.amount), 0)
  const partyTotal = (partyRows ?? [])
    .filter((r) => r.entryType === 'invoice')
    .reduce((s, r) => s + Math.abs(r.amount), 0)

  const missingInParty = (results ?? [])
    .filter((r) => r.status === MATCH_STATUS.MISSING_IN_PARTY)
    .reduce((s, r) => s + Math.abs(r.ourAmount || 0), 0)
  const missingInOurs = (results ?? [])
    .filter((r) => r.status === MATCH_STATUS.MISSING_IN_OURS)
    .reduce((s, r) => s + Math.abs(r.partyAmount || 0), 0)
  const amountMismatch = (results ?? [])
    .filter((r) => String(r.status || '').includes('Mismatch'))
    .reduce((s, r) => s + Math.abs(r.difference || 0), 0)

  return {
    ourTotal,
    partyTotal,
    netDifference: ourTotal - partyTotal,
    matched: (results ?? []).filter((r) => r.status === MATCH_STATUS.MATCHED).length,
    missingInParty,
    missingInOurs,
    amountMismatch,
    totalRows: (results ?? []).length,
  }
}
