import { useId, useMemo, useState } from 'react'
import { guessMapping } from './autoMap'
import { exportResultsToExcel } from './export'
import { parseFile } from './fileParsers'
import { matchLedgerToStatement } from './match'
import { normalizeRows } from './normalize'

function UploadCard({ title, subtitle, file, onPickFile, accept }) {
  const id = useId()
  return (
    <label className={`upload-card ${file ? 'has-file' : ''}`} htmlFor={id}>
      <div className="upload-icon">{file ? '✓' : '⬆'}</div>
      <span>{title}</span>
      <small>{file ? file.name : subtitle}</small>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          onPickFile(f)
          e.target.value = ''
        }}
      />
    </label>
  )
}

function FieldSelect({ label, value, headers, onChange, required = false }) {
  return (
    <label className="mapper-field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {(headers ?? []).map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  )
}

function ColumnMapper({ title, headers, mapping, onChange }) {
  return (
    <div className="mapper-card">
      <h3>{title}</h3>
      <div className="mapper-grid">
        <FieldSelect
          label="Date"
          required
          headers={headers}
          value={mapping.date}
          onChange={(v) => onChange({ ...mapping, date: v })}
        />
        <FieldSelect
          label="Amount"
          required
          headers={headers}
          value={mapping.amount}
          onChange={(v) => onChange({ ...mapping, amount: v })}
        />
        <FieldSelect
          label="Description"
          headers={headers}
          value={mapping.description}
          onChange={(v) => onChange({ ...mapping, description: v })}
        />
        <FieldSelect
          label="Reference (Invoice/UTR/Cheque)"
          headers={headers}
          value={mapping.reference}
          onChange={(v) => onChange({ ...mapping, reference: v })}
        />
      </div>
      <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Tip: mapping a Reference improves exact matching. Description enables fuzzy matching.
      </div>
    </div>
  )
}

function StatsDashboard({ results }) {
  const stats = useMemo(() => {
    const byStatus = new Map()
    let matched = 0
    for (const r of results ?? []) {
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
      if (r.status === 'Matched') matched++
    }
    return { byStatus, matched, total: (results ?? []).length }
  }, [results])

  const get = (k) => stats.byStatus.get(k) ?? 0

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value">{stats.total}</div>
        <div className="stat-label">Total Records</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: 'var(--green)' }}>{get('Matched')}</div>
        <div className="stat-label">Matched</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: 'var(--orange)' }}>{get('Amount Mismatch')}</div>
        <div className="stat-label">Amount Mismatch</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: 'var(--yellow)' }}>{get('Timing Difference')}</div>
        <div className="stat-label">Timing Difference</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: 'var(--red)' }}>{get('Missing in Party Statement')}</div>
        <div className="stat-label">Missing in Statement</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: 'var(--blue)' }}>{get('Missing in My Ledger')}</div>
        <div className="stat-label">Missing in Ledger</div>
      </div>
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'Matched', label: 'Matched' },
  { value: 'Amount Mismatch', label: 'Amount Mismatch' },
  { value: 'Timing Difference', label: 'Timing Difference' },
  { value: 'Missing in Party Statement', label: 'Missing in Statement' },
  { value: 'Missing in My Ledger', label: 'Missing in Ledger' },
]

export default function LedgerMatchMVP() {
  const [ledgerFile, setLedgerFile] = useState(null)
  const [statementFile, setStatementFile] = useState(null)
  const [ledgerInfo, setLedgerInfo] = useState(null)
  const [statementInfo, setStatementInfo] = useState(null)

  const [ledgerMap, setLedgerMap] = useState({ date: '', amount: '', description: '', reference: '' })
  const [statementMap, setStatementMap] = useState({ date: '', amount: '', description: '', reference: '' })

  const [ledgerAmountMode, setLedgerAmountMode] = useState('as_is')
  const [statementAmountMode, setStatementAmountMode] = useState('as_is')

  const [amountTolerance, setAmountTolerance] = useState(1)
  const [dateWindowDays, setDateWindowDays] = useState(3)
  const [preferReference, setPreferReference] = useState(true)
  const [useFuzzy, setUseFuzzy] = useState(true)
  const [fuzzyThreshold, setFuzzyThreshold] = useState(0.35)

  const [results, setResults] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const canReconcile = Boolean(ledgerInfo && statementInfo && ledgerMap.date && ledgerMap.amount && statementMap.date && statementMap.amount)

  const ledgerRows = useMemo(() => {
    if (!ledgerInfo) return []
    return normalizeRows(ledgerInfo.rows, ledgerMap, { amountMode: ledgerAmountMode }, ledgerInfo.format)
  }, [ledgerInfo, ledgerMap, ledgerAmountMode])

  const statementRows = useMemo(() => {
    if (!statementInfo) return []
    return normalizeRows(statementInfo.rows, statementMap, { amountMode: statementAmountMode }, statementInfo.format)
  }, [statementInfo, statementMap, statementAmountMode])

  const filteredResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return (results ?? []).filter((r) => {
      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false
      if (!q) return true
      const blob = [
        r.ledger?.referenceRaw,
        r.statement?.referenceRaw,
        r.ledgerDescription,
        r.statementDescription,
        String(r.ledgerAmount ?? ''),
        String(r.statementAmount ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [results, searchQuery, filterStatus])

  async function handlePickLedger(file) {
    setError('')
    setResults([])
    setLedgerFile(file)
    setLedgerInfo(null)
    if (!file) return
    setBusy(true)
    try {
      const info = await parseFile(file) as any
      setLedgerInfo(info)
      setLedgerMap((prev) => ({ ...prev, ...guessMapping(info.headers) }))
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handlePickStatement(file) {
    setError('')
    setResults([])
    setStatementFile(file)
    setStatementInfo(null)
    if (!file) return
    setBusy(true)
    try {
      const info = await parseFile(file) as any
      setStatementInfo(info)
      setStatementMap((prev) => ({ ...prev, ...guessMapping(info.headers) }))
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  function runMatch() {
    setError('')
    if (!canReconcile) {
      setError('Please upload both files and map required columns (Date + Amount).')
      return
    }
    setBusy(true)
    try {
      const res = matchLedgerToStatement(ledgerRows, statementRows, {
        amountTolerance: Number(amountTolerance) || 0,
        dateWindowDays: Number(dateWindowDays) || 0,
        preferReference,
        useFuzzy,
        fuzzyThreshold: Number(fuzzyThreshold) || 0.35,
      })
      setResults(res)
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  function exportExcel() {
    exportResultsToExcel({
      results,
      ledgerRows,
      statementRows,
      fileNameBase: `ledger-match-${new Date().toISOString().slice(0, 10)}`,
    })
  }

  return (
    <div>
      <header className="app-header">
        <h1>LedgerMatch</h1>
        <p>Upload your ledger and statement, map columns, and match transactions with exact + fuzzy logic.</p>
      </header>

      <div className="upload-grid">
        <UploadCard
          title="Upload Ledger"
          subtitle="CSV/XLSX with Date + Amount"
          file={ledgerFile}
          onPickFile={handlePickLedger}
          accept=".csv,.xlsx,.xls"
        />
        <UploadCard
          title="Upload Statement"
          subtitle="CSV/XLSX with Date + Amount"
          file={statementFile}
          onPickFile={handlePickStatement}
          accept=".csv,.xlsx,.xls"
        />
      </div>

      {error && (
        <div className="tool-result warn" style={{ marginTop: 0, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {ledgerInfo && (
        <ColumnMapper
          title="Column Mapping - Ledger"
          headers={ledgerInfo.headers}
          mapping={ledgerMap}
          onChange={setLedgerMap}
        />
      )}

      {statementInfo && (
        <ColumnMapper
          title="Column Mapping - Statement"
          headers={statementInfo.headers}
          mapping={statementMap}
          onChange={setStatementMap}
        />
      )}

      {(ledgerInfo || statementInfo) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 10 }}>Match Settings</h3>
          <div className="mapper-grid">
            <label className="mapper-field">
              <span>Amount tolerance</span>
              <input
                type="number"
                step="0.01"
                value={amountTolerance}
                onChange={(e) => setAmountTolerance(Number(e.target.value))}
              />
            </label>
            <label className="mapper-field">
              <span>Date window (days)</span>
              <input
                type="number"
                step="1"
                value={dateWindowDays}
                onChange={(e) => setDateWindowDays(Number(e.target.value))}
              />
            </label>
            <label className="mapper-field">
              <span>Ledger amount mode</span>
              <select value={ledgerAmountMode} onChange={(e) => setLedgerAmountMode(e.target.value)}>
                <option value="as_is">As-is</option>
                <option value="absolute">Absolute</option>
              </select>
            </label>
            <label className="mapper-field">
              <span>Statement amount mode</span>
              <select value={statementAmountMode} onChange={(e) => setStatementAmountMode(e.target.value)}>
                <option value="as_is">As-is</option>
                <option value="absolute">Absolute</option>
                <option value="invert">Invert sign</option>
              </select>
            </label>
            <label className="mapper-field">
              <span>Prefer reference match</span>
              <select value={preferReference ? 'yes' : 'no'} onChange={(e) => setPreferReference(e.target.value === 'yes')}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="mapper-field">
              <span>Fuzzy matching</span>
              <select value={useFuzzy ? 'yes' : 'no'} onChange={(e) => setUseFuzzy(e.target.value === 'yes')}>
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </label>
            <label className="mapper-field">
              <span>Fuzzy threshold</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={fuzzyThreshold}
                onChange={(e) => setFuzzyThreshold(Number(e.target.value))}
                disabled={!useFuzzy}
              />
            </label>
          </div>
          <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Lower fuzzy threshold is stricter. If you get too many mismatches, reduce date window first.
          </div>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={runMatch} disabled={!canReconcile || busy}>
          {busy ? 'Working...' : canReconcile ? 'Run LedgerMatch' : 'Upload + map required fields'}
        </button>
        <button type="button" className="btn btn-success" onClick={exportExcel} disabled={!results.length}>
          Export to Excel
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setLedgerFile(null)
            setStatementFile(null)
            setLedgerInfo(null)
            setStatementInfo(null)
            setResults([])
            setError('')
          }}
        >
          Reset
        </button>
      </div>

      {results.length > 0 && (
        <>
          <StatsDashboard results={results} />

          <div className="filters-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Search reference/description/amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="results">
            <div className="results-count">
              Showing {filteredResults.length} of {results.length} records
            </div>
            <div className="results-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th>Ledger Date</th>
                    <th>Ledger Amount</th>
                    <th>Ledger Ref</th>
                    <th>Ledger Description</th>
                    <th>Statement Date</th>
                    <th>Statement Amount</th>
                    <th>Statement Ref</th>
                    <th>Statement Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        style={{
                          textAlign: 'center',
                          padding: '32px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        No records match your filters.
                      </td>
                    </tr>
                  )}
                  {filteredResults.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className={`status-pill status-${String(r.status).replace(/\s+/g, '-')}`}>
                          {r.status === 'Missing in Party Statement' ? 'Missing in Statement' : r.status}
                        </span>
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {typeof r.confidence === 'number' && r.confidence > 0 ? r.confidence.toFixed(2) : '\u2014'}
                      </td>
                      <td>{r.ledgerDate || '\u2014'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r.ledgerAmount !== '' ? Number(r.ledgerAmount).toLocaleString('en-IN') : '\u2014'}
                      </td>
                      <td>{r.ledger?.referenceRaw || '\u2014'}</td>
                      <td>{r.ledgerDescription || '\u2014'}</td>
                      <td>{r.statementDate || '\u2014'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r.statementAmount !== '' ? Number(r.statementAmount).toLocaleString('en-IN') : '\u2014'}
                      </td>
                      <td>{r.statement?.referenceRaw || '\u2014'}</td>
                      <td>{r.statementDescription || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
