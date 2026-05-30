import { useMemo, useState } from 'react'
import { MATCH_STATUS, STATUS_COLORS } from './constants'

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'MATCHED', label: 'Matched' },
  { key: 'MISMATCH', label: 'Mismatches' },
  { key: 'MISSING', label: 'Missing' },
  { key: 'POSSIBLE', label: 'Possible Matches' },
  { key: 'DUPLICATES', label: 'Duplicates' },
]

function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return ''
  const num = Number(n)
  if (!Number.isFinite(num)) return String(n)
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return ''
  try {
    return d.toLocaleDateString('en-IN')
  } catch {
    return ''
  }
}

function statusBadge(status) {
  const bg = STATUS_COLORS[status] ?? 'rgba(255,255,255,0.08)'
  return (
    <span
      className="badge"
      style={{
        background: bg,
        color: '#0b1220',
        fontWeight: 800,
      }}
    >
      {status}
    </span>
  )
}

function SummaryCards({ summary }) {
  const items = [
    { label: 'Total Our Invoices', value: fmtMoney(summary.ourTotal) },
    { label: 'Total Party Invoices', value: fmtMoney(summary.partyTotal) },
    { label: 'Net Difference', value: fmtMoney(summary.netDifference) },
    { label: 'Matched', value: String(summary.matched ?? 0) },
    { label: 'Unmatched', value: String((summary.totalRows ?? 0) - (summary.matched ?? 0)) },
  ]

  return (
    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      {items.map((it) => (
        <div key={it.label} className="stat-card">
          <div className="stat-value">{it.value}</div>
          <div className="stat-label">{it.label}</div>
        </div>
      ))}
    </div>
  )
}

function applyTabFilter(row, tabKey) {
  if (tabKey === 'ALL') return true
  if (tabKey === 'MATCHED') return row.status === MATCH_STATUS.MATCHED
  if (tabKey === 'MISMATCH') return String(row.status).includes('Mismatch')
  if (tabKey === 'MISSING')
    return row.status === MATCH_STATUS.MISSING_IN_PARTY || row.status === MATCH_STATUS.MISSING_IN_OURS
  if (tabKey === 'POSSIBLE')
    return row.status === MATCH_STATUS.POSSIBLE_TYPO || row.status === MATCH_STATUS.MATCHED_BY_AMOUNT_DATE
  if (tabKey === 'DUPLICATES') return String(row.status).startsWith('Duplicate')
  return true
}

function compare(a, b, dir) {
  const d = dir === 'desc' ? -1 : 1
  if (a === b) return 0
  if (a === null || a === undefined || a === '') return 1 * d
  if (b === null || b === undefined || b === '') return -1 * d
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 * d : 1 * d
  const sa = String(a).toLowerCase()
  const sb = String(b).toLowerCase()
  return sa < sb ? -1 * d : 1 * d
}

export default function ResultsTable({ results, summary, partyName, recoDate, onExport }) {
  const [tab, setTab] = useState('ALL')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('refNo')
  const [sortDir, setSortDir] = useState('asc')
  const [remarksByRef, setRemarksByRef] = useState(() => ({}))

  const viewRows = useMemo(() => {
    const q = query.trim().toUpperCase()
    const filtered = (results ?? [])
      .filter((r) => applyTabFilter(r, tab))
      .filter((r) => {
        if (!q) return true
        const hay = `${r.refNo ?? ''} ${r.ourNarration ?? ''} ${r.partyNarration ?? ''}`.toUpperCase()
        return hay.includes(q)
      })
      .map((r) => ({
        ...r,
        remarks: remarksByRef[r.refNo] ?? r.remarks ?? '',
      }))

    const sorted = [...filtered].sort((ra, rb) => compare(ra[sortKey], rb[sortKey], sortDir))
    return sorted
  }, [results, tab, query, sortKey, sortDir, remarksByRef])

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  return (
    <div>
      <header className="app-header">
        <h1>Results</h1>
        <p>
          Ledger reconciliation for <span style={{ fontWeight: 700 }}>{partyName || 'Party'}</span> as on{' '}
          <span style={{ fontWeight: 700 }}>{recoDate}</span>.
        </p>
      </header>

      <SummaryCards summary={summary} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="filters-bar">
        <input
          className="search-input"
          placeholder="Search ref or narration..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="results" style={{ marginTop: 14 }}>
        <div className="results-count">
          Showing {viewRows.length} of {(results ?? []).length} rows
        </div>

        <div className="results-table-wrap">
          <table>
            <thead>
              <tr>
                <th role="button" onClick={() => toggleSort('refNo')}>Ref No</th>
                <th role="button" onClick={() => toggleSort('ourDate')}>Our Date</th>
                <th role="button" onClick={() => toggleSort('ourAmount')}>Our Amount</th>
                <th role="button" onClick={() => toggleSort('partyDate')}>Party Date</th>
                <th role="button" onClick={() => toggleSort('partyAmount')}>Party Amount</th>
                <th role="button" onClick={() => toggleSort('difference')}>Difference</th>
                <th role="button" onClick={() => toggleSort('status')}>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {viewRows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No rows match your filters.
                  </td>
                </tr>
              )}
              {viewRows.map((r, idx) => (
                <tr key={`${r.refNo}-${r.status}-${idx}`}>
                  <td style={{ fontWeight: 700 }}>{r.rawRefNo || r.refNo}</td>
                  <td>{fmtDate(r.ourDate) || '\u2014'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.ourAmount) || '\u2014'}</td>
                  <td>{fmtDate(r.partyDate) || '\u2014'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.partyAmount) || '\u2014'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.difference) || '\u2014'}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{ minWidth: 220 }}>
                    <input
                      type="text"
                      value={remarksByRef[r.refNo] ?? r.remarks ?? ''}
                      onChange={(e) => setRemarksByRef((m) => ({ ...m, [r.refNo]: e.target.value }))}
                      placeholder="Add remark..."
                      style={{ width: '100%' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-success" onClick={() => onExport(viewRows, remarksByRef)}>
          Export
        </button>
      </div>
    </div>
  )
}
