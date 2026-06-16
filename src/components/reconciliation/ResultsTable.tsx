import { useMemo, useState } from 'react'
import { MATCH_STATUS, STATUS_COLORS } from './constants'

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'MATCHED', label: 'Matched' },
  { key: 'MISMATCH', label: 'Mismatches' },
  { key: 'TDS', label: 'TDS Deductions' },
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

function currencySymbol(code: string): string {
  if (code === 'USD') return '$'
  if (code === 'EUR') return '€'
  return '₹'
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
  let bg = STATUS_COLORS[status]
  if (!bg && String(status).startsWith('TDS Deduction')) bg = '#8b5cf6'
  if (!bg && String(status).startsWith('TDS Amount')) bg = '#f97316'
  if (!bg) bg = 'rgba(255,255,255,0.08)'
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

function SummaryStatement({ summary, recoDate, partyName, sym }: any) {
  if (!summary) return null

  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
      <div>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>RECONCILIATION SUMMARY</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
          As on: <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{recoDate}</span> | 
          Party: <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{partyName || 'Unknown Party'}</span>
        </div>
        
        <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '8px 0' }}>Balance as per Party Books</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sym} {fmtMoney(summary.partyNetBalance)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '8px 0' }}>Add: Invoices not in Party Books</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sym} {fmtMoney(summary.invoicesNotInParty)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '8px 0' }}>Add: TDS to be booked</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sym} {fmtMoney(summary.tdsToBeBooked)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '8px 0' }}>Less: Invoices not in Our Books</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sym} {fmtMoney(summary.invoicesNotInOurs)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '8px 0' }}>Less: Amount Differences</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sym} {fmtMoney(summary.amountDifferences)}</td>
            </tr>
            <tr>
              <td style={{ padding: '12px 0 4px', fontWeight: 700 }}>Derived Balance</td>
              <td style={{ padding: '12px 0 4px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{sym} {fmtMoney(summary.derivedBalance)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: '4px 0 12px', fontWeight: 700 }}>Balance as per Our Books</td>
              <td style={{ padding: '4px 0 12px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{sym} {fmtMoney(summary.ourNetBalance)}</td>
            </tr>
            <tr>
              <td style={{ padding: '12px 0 0', fontWeight: 700 }}>Difference</td>
              <td style={{ padding: '12px 0 0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: (summary.finalDifference || 0) !== 0 ? 'var(--red)' : 'var(--green)' }}>
                {sym} {fmtMoney(summary.finalDifference)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ paddingLeft: 24, borderLeft: '1px solid var(--border-light)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Status Breakdown</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.95rem' }}>
          <div>✅ Matched: <strong>{summary.matched}</strong> rows</div>
          <div>🟡 TDS Deductions: <strong>{summary.tdsFlagged}</strong> rows</div>
          <div>🔴 Missing in Party: <strong>{summary.missingInParty}</strong> rows</div>
          <div>🔴 Missing in Our Books: <strong>{summary.missingInOurs}</strong> rows</div>
          <div>🟠 Amount Mismatches: <strong>{summary.mismatch}</strong> rows</div>
          <div>🔵 Possible Matches: <strong>{summary.possible}</strong> rows</div>
        </div>
      </div>
    </div>
  )
}

function applyTabFilter(row, tabKey) {
  if (tabKey === 'ALL') return true
  if (tabKey === 'MATCHED') return row.status === MATCH_STATUS.MATCHED
  if (tabKey === 'MISMATCH') return String(row.status).includes('Mismatch')
  if (tabKey === 'TDS') return String(row.status).startsWith('TDS')
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

export default function ResultsTable({ results, summary, partyName, recoDate, onExport, onRemarksChange, onActionStatusChange }: any) {
  const [tab, setTab] = useState('ALL')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('refNo')
  const [sortDir, setSortDir] = useState('asc')
  const [remarksByRef, setRemarksByRef] = useState(() => ({}))
  
  const [actionStatuses, setActionStatuses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    ;(results ?? []).forEach((r, idx) => {
      const key = r.refNo || String(idx)
      let status = 'Open'
      if (r.status === MATCH_STATUS.MATCHED) status = 'Resolved'
      else if (r.status === MATCH_STATUS.MISSING_IN_PARTY) status = 'Invoice Not Received by Party'
      else if (String(r.status).startsWith('TDS Deduction')) status = 'TDS to be Booked'
      initial[key] = status
    })
    return initial
  })

  // Propagate changes if callbacks provided
  useMemo(() => {
    if (onRemarksChange) onRemarksChange(remarksByRef)
  }, [remarksByRef, onRemarksChange])
  useMemo(() => {
    if (onActionStatusChange) onActionStatusChange(actionStatuses)
  }, [actionStatuses, onActionStatusChange])

  const viewRows = useMemo(() => {
    const q = query.trim().toUpperCase()
    const filtered = (results ?? [])
      .filter((r) => applyTabFilter(r, tab))
      .filter((r) => {
        if (!q) return true
        const hay = `${r.refNo ?? ''} ${r.ourNarration ?? ''} ${r.partyNarration ?? ''}`.toUpperCase()
        return hay.includes(q)
      })
      .map((r, idx) => {
        const key = r.refNo || String(idx)
        return {
          ...r,
          actionStatus: actionStatuses[key] || 'Open',
          remarks: remarksByRef[r.refNo] ?? r.remarks ?? '',
          rowKey: key
        }
      })

    const sorted = [...filtered].sort((ra, rb) => compare(ra[sortKey], rb[sortKey], sortDir))
    return sorted
  }, [results, tab, query, sortKey, sortDir, remarksByRef, actionStatuses])

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  const primaryCurrency = (results && results.length > 0) ? results[0].ourCurrency || 'INR' : 'INR'
  const sym = currencySymbol(primaryCurrency)

  return (
    <div>
      <header className="app-header">
        <h1>Results</h1>
        <p>
          Ledger reconciliation for <span style={{ fontWeight: 700 }}>{partyName || 'Unknown Party'}</span> as on{' '}
          <span style={{ fontWeight: 700 }}>{recoDate}</span>.
        </p>
      </header>

      <SummaryStatement summary={summary} recoDate={recoDate} partyName={partyName} sym={sym} />

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
                <th role="button" onClick={() => toggleSort('actionStatus')}>Action Status</th>
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
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.ourAmount ? `${currencySymbol(r.ourCurrency || 'INR')} ${fmtMoney(r.ourAmount)}` : '\u2014'}</td>
                  <td>{fmtDate(r.partyDate) || '\u2014'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.partyAmount ? `${currencySymbol(r.partyCurrency || 'INR')} ${fmtMoney(r.partyAmount)}` : '\u2014'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: (Number(r.difference) || 0) !== 0 ? 'var(--red)' : 'var(--green)' }}>{fmtMoney(r.difference) || '\u2014'}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{ minWidth: 180 }}>
                    <select
                      value={actionStatuses[r.rowKey] || 'Open'}
                      onChange={(e) => setActionStatuses((m) => ({ ...m, [r.rowKey]: e.target.value }))}
                      style={{ width: '100%', padding: '4px' }}
                    >
                      <option value="Open">Open</option>
                      <option value="TDS to be Booked">TDS to be Booked</option>
                      <option value="Credit Note to be Passed">Credit Note to be Passed</option>
                      <option value="Invoice Not Received by Party">Invoice Not Received by Party</option>
                      <option value="Under Dispute">Under Dispute</option>
                      <option value="To be Followed Up">To be Followed Up</option>
                      <option value="Accepted Difference">Accepted Difference</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </td>
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
            <tfoot>
              <tr style={{ fontWeight: 'bold', background: 'var(--bg-elevated)' }}>
                <td colSpan={2} style={{ textAlign: 'right', paddingRight: 16 }}>Totals for visible rows:</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(viewRows.reduce((acc, r) => acc + (Number(r.ourAmount) || 0), 0))}
                </td>
                <td></td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(viewRows.reduce((acc, r) => acc + (Number(r.partyAmount) || 0), 0))}
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(viewRows.reduce((acc, r) => acc + (Number(r.difference) || 0), 0))}
                </td>
                <td colSpan={2}>
                  <div style={{ fontSize: '0.85em', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                    Open: {viewRows.filter(r => r.actionStatus === 'Open').length} | 
                    Resolved: {viewRows.filter(r => r.actionStatus === 'Resolved').length} | 
                    Under Dispute: {viewRows.filter(r => r.actionStatus === 'Under Dispute').length}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-success" onClick={() => onExport(viewRows, remarksByRef, actionStatuses)}>
          Export
        </button>
      </div>
    </div>
  )
}
