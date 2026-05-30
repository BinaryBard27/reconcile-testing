import Fuse from 'fuse.js'
import { clamp01, diffDays } from './utils'

function bestByScore(items, scoreFn) {
  let best = null
  let bestScore = Infinity
  for (const it of items) {
    const s = scoreFn(it)
    if (s < bestScore) {
      bestScore = s
      best = it
    }
  }
  return { best, bestScore }
}

function amountDiff(a, b) {
  return Math.abs((a ?? 0) - (b ?? 0))
}

export function matchLedgerToStatement(ledgerRows, statementRows, settings) {
  const {
    amountTolerance = 1,
    dateWindowDays = 3,
    preferReference = true,
    useFuzzy = true,
    fuzzyThreshold = 0.35,
    maxFuzzyCandidates = 10,
  } = settings ?? {}

  const unused = new Set(statementRows.map((r) => r.id))

  const statementByRef = new Map()
  for (const s of statementRows) {
    if (!s.reference) continue
    if (!statementByRef.has(s.reference)) statementByRef.set(s.reference, [])
    statementByRef.get(s.reference).push(s)
  }

  const fuse = useFuzzy
    ? new Fuse<any>(statementRows, {
        includeScore: true,
        threshold: fuzzyThreshold,
        ignoreLocation: true,
        minMatchCharLength: 3,
        keys: ['description', 'referenceRaw'],
      })
    : null

  const results = []

  for (const l of ledgerRows) {
    let match = null
    let matchMeta = null

    const dateOk = (s) => diffDays(l.dateObj, s.dateObj) <= dateWindowDays
    const amtOk = (s) => amountDiff(l.amount, s.amount) <= amountTolerance

    if (preferReference && l.reference) {
      const candidates = (statementByRef.get(l.reference) ?? []).filter((s) => unused.has(s.id))
      if (candidates.length) {
        const { best } = bestByScore(candidates, (s) => {
          const dd = diffDays(l.dateObj, s.dateObj)
          const ad = amountDiff(l.amount, s.amount)
          return dd * 10 + ad
        })
        match = best
        matchMeta = { kind: 'reference' }
      }
    }

    if (!match) {
      // Strong candidates: amount + date window.
      const candidates = statementRows.filter((s) => unused.has(s.id) && dateOk(s) && amtOk(s))
      if (candidates.length) {
        const { best } = bestByScore(candidates, (s) => {
          const dd = diffDays(l.dateObj, s.dateObj)
          const ad = amountDiff(l.amount, s.amount)
          return dd * 10 + ad
        })
        match = best
        matchMeta = { kind: 'amount_date' }
      }
    }

    if (!match && fuse && l.description) {
      // Fuzzy candidates, then filtered by date/amount.
      const f = fuse.search(l.description, { limit: maxFuzzyCandidates })
      const candidates = f
        .map((x) => ({ item: x.item, fuseScore: x.score }))
        .filter((x) => unused.has(x.item.id))
        .filter((x) => dateOk(x.item) || amtOk(x.item))

      if (candidates.length) {
        const { best } = bestByScore(candidates, (x) => {
          const dd = diffDays(l.dateObj, x.item.dateObj)
          const ad = amountDiff(l.amount, x.item.amount)
          const fs = x.fuseScore ?? 1
          return fs * 100 + dd * 5 + ad
        })
        match = best.item
        matchMeta = { kind: 'fuzzy', fuseScore: best.fuseScore ?? 1 }
      }
    }

    if (match) {
      unused.delete(match.id)

      const ad = amountDiff(l.amount, match.amount)
      const dd = diffDays(l.dateObj, match.dateObj)

      let status = 'Matched'
      if (ad > amountTolerance) status = 'Amount Mismatch'
      else if (dd > dateWindowDays) status = 'Timing Difference'
      else if (matchMeta?.kind === 'fuzzy') status = 'Matched'

      // Confidence is heuristic, for sorting/review. 1 = best.
      const amtScore = 1 - clamp01(ad / Math.max(1e-9, amountTolerance))
      const dateScore = 1 - clamp01(dd / Math.max(1e-9, dateWindowDays))
      const fuzzyScore =
        matchMeta?.kind === 'fuzzy'
          ? 1 - clamp01((matchMeta.fuseScore ?? 1) / Math.max(1e-9, fuzzyThreshold))
          : 1
      const confidence = clamp01(0.45 * amtScore + 0.35 * dateScore + 0.2 * fuzzyScore)

      results.push({
        id: `L${l.id}-S${match.id}`,
        status,
        confidence,
        reason: matchMeta?.kind ?? '',

        ledger: l,
        statement: match,

        ledgerDate: l.date,
        statementDate: match.date,
        ledgerAmount: l.amount,
        statementAmount: match.amount,
        ledgerDescription: l.description,
        statementDescription: match.description,
      })
      continue
    }

    results.push({
      id: `L${l.id}-NONE`,
      status: 'Missing in Party Statement',
      confidence: 0,
      reason: '',
      ledger: l,
      statement: null,

      ledgerDate: l.date,
      statementDate: '',
      ledgerAmount: l.amount,
      statementAmount: '',
      ledgerDescription: l.description,
      statementDescription: '',
    })
  }

  for (const s of statementRows) {
    if (!unused.has(s.id)) continue
    results.push({
      id: `NONE-S${s.id}`,
      status: 'Missing in My Ledger',
      confidence: 0,
      reason: '',
      ledger: null,
      statement: s,

      ledgerDate: '',
      statementDate: s.date,
      ledgerAmount: '',
      statementAmount: s.amount,
      ledgerDescription: '',
      statementDescription: s.description,
    })
  }

  return results
}
