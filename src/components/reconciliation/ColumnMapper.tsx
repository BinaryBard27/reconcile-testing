import { useEffect, useMemo, useState } from 'react'
import { ENTRY_TYPES } from './constants'
import { detectFormatAndSuggestMapping, DetectedFormat } from './autoDetect'
import { loadMapping, saveMapping } from './persistence'

const FIELD_DEFS = [
  { key: 'refNo', label: 'Reference Number', required: true },
  { key: 'entryType', label: 'Entry Type / Doc Type', required: false },
  { key: 'date', label: 'Date', required: true },
  { key: 'amountINR', label: 'Amount (Single Column)', required: false },
  { key: 'debitAmount', label: 'Debit Amount', required: false },
  { key: 'creditAmount', label: 'Credit Amount', required: false },
  { key: 'narration', label: 'Narration / Description', required: false },
  { key: 'utr', label: 'Bank UTR / Payment Ref', required: false },
]

const ENTRY_TYPE_LABELS = [
  { value: ENTRY_TYPES.INVOICE, label: 'Invoice (Debit)' },
  { value: ENTRY_TYPES.PAYMENT, label: 'Payment (Credit)' },
  { value: ENTRY_TYPES.CREDIT_NOTE, label: 'Credit Note (Credit)' },
  { value: ENTRY_TYPES.ADJUSTMENT, label: 'Adjustment' },
  { value: ENTRY_TYPES.IGNORE, label: 'Ignore' },
]

function smartDefaultForValue(v: string) {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return ENTRY_TYPES.IGNORE

  if (['dr', 'dz', 'rv', 'sales', 'invoice', 'inv'].some(x => s.includes(x))) return ENTRY_TYPES.INVOICE
  if (['cr', 'kz', 'payment', 'receipt', 'pay'].some(x => s.includes(x))) return ENTRY_TYPES.PAYMENT
  if (['dg', 'credit note', 'cn'].some(x => s.includes(x))) return ENTRY_TYPES.CREDIT_NOTE
  if (['dy', 'sa', 'journal', 'adj'].some(x => s.includes(x))) return ENTRY_TYPES.ADJUSTMENT

  return ENTRY_TYPES.IGNORE
}

function uniq(arr: any[]) {
  return [...new Set(arr.map(x => String(x ?? '').trim()).filter(Boolean))]
}

function FieldSelect({ label, required, headers, value, onChange }: any) {
  return (
    <label className="mapper-field">
      <span>{label}{required ? ' *' : ''}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {(headers ?? []).map((h: string) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </label>
  )
}

export default function ColumnMapper({
  headers,
  rawRows,
  fileLabel,
  onMappingComplete,
  showGlobalSettings = false,
  partyName = '',
  setPartyName = undefined,
  recoDate = '',
  setRecoDate = undefined,
  currency = 'INR',
  setCurrency = undefined,
}: any) {
  const [mapping, setMapping] = useState(() => ({
    refNo: '', entryType: '', date: '', amountINR: '',
    debitAmount: '', creditAmount: '', narration: '', utr: ''
  }))

  const [amountLogic, setAmountLogic] = useState<'signed' | 'separate' | 'doctype'>('signed')
  const [entryTypeMap, setEntryTypeMap] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null)
  const [loadedFromCache, setLoadedFromCache] = useState(false)

  // Initialization: Load from cache or auto-detect
  useEffect(() => {
    if (!headers || headers.length === 0) return

    const cached = loadMapping(partyName, fileLabel)
    if (cached) {
      setMapping(cached.mapping || {})
      setEntryTypeMap(cached.entryTypeMap || {})
      setAmountLogic(cached.mappingConfig?.amountLogic || 'signed')
      setLoadedFromCache(true)
      return
    }

    const { format, suggestion } = detectFormatAndSuggestMapping(headers, rawRows || [])
    setDetectedFormat(format)
    
    setMapping((prev) => ({
      ...prev,
      refNo: suggestion.refNo || '',
      entryType: suggestion.entryType || '',
      date: suggestion.date || '',
      amountINR: suggestion.amountINR || '',
      debitAmount: suggestion.debitAmount || '',
      creditAmount: suggestion.creditAmount || '',
      narration: suggestion.narration || '',
      utr: suggestion.utr || ''
    }))
    setAmountLogic(suggestion.amountLogic)
  }, [headers, partyName, fileLabel, rawRows])

  const uniqueEntryTypeValues = useMemo(() => {
    if (!mapping.entryType) return []
    const vals = (rawRows ?? []).map((r: any) => r?.[mapping.entryType])
    return uniq(vals)
  }, [rawRows, mapping.entryType])

  useEffect(() => {
    if (!mapping.entryType || loadedFromCache) return
    setEntryTypeMap((prev) => {
      const next = { ...prev }
      for (const v of uniqueEntryTypeValues) {
        if (next[v] !== undefined) continue
        next[v] = smartDefaultForValue(v)
      }
      return next
    })
  }, [mapping.entryType, uniqueEntryTypeValues, loadedFromCache])

  function validate() {
    if (!mapping.refNo || !mapping.date) return 'Missing required fields: Reference Number and Date.'
    if (amountLogic === 'separate' && (!mapping.debitAmount || !mapping.creditAmount)) {
      return 'Please map both Debit and Credit columns.'
    }
    if (amountLogic !== 'separate' && !mapping.amountINR) {
      return 'Please map the Amount column.'
    }
    if (amountLogic === 'doctype' && !mapping.entryType) {
      return 'Doc Type dependent amount logic requires an Entry Type / Doc Type column.'
    }
    return ''
  }

  function confirm() {
    const msg = validate()
    if (msg) return setError(msg)
    setError('')
    
    saveMapping(partyName, fileLabel, mapping, entryTypeMap, { amountLogic })
    onMappingComplete(mapping, entryTypeMap, { amountLogic })
  }

  return (
    <div>
      <header className="app-header" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: '1.25rem' }}>{fileLabel} — Mapping</h1>
        <p>Select how columns map into LedgerMatch’s standard format.</p>
        {detectedFormat && detectedFormat !== 'GENERIC' && !loadedFromCache && (
          <div className="status-pill status-Matched" style={{ display: 'inline-block', marginTop: 4 }}>
            Auto-detected: {detectedFormat} Format
          </div>
        )}
        {loadedFromCache && (
          <div className="status-pill status-Matched" style={{ display: 'inline-block', marginTop: 4 }}>
            Loaded previous mapping for this vendor
          </div>
        )}
      </header>

      {error && <div className="tool-result warn" style={{ marginTop: 0, marginBottom: 16 }}>{error}</div>}

      <div className="mapper-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Amount Logic</h3>
          <select value={amountLogic} onChange={(e: any) => setAmountLogic(e.target.value)}>
            <option value="signed">Single Column (+/- Signed)</option>
            <option value="separate">Separate Debit / Credit Columns</option>
            <option value="doctype">Sign depends on Doc Type (SAP style)</option>
          </select>
        </div>
      </div>

      <div className="mapper-card">
        <h3>Field Mapping</h3>
        <div className="mapper-grid">
          {FIELD_DEFS.map((f) => {
            const isAmountCol = f.key === 'amountINR' || f.key === 'debitAmount' || f.key === 'creditAmount'
            if (amountLogic === 'separate' && f.key === 'amountINR') return null
            if (amountLogic !== 'separate' && (f.key === 'debitAmount' || f.key === 'creditAmount')) return null
            if (amountLogic === 'doctype' && f.key === 'entryType') f.required = true

            return (
              <FieldSelect
                key={f.key}
                label={f.label}
                required={f.required}
                headers={headers}
                value={(mapping as any)[f.key]}
                onChange={(v: string) => setMapping(m => ({ ...m, [f.key]: v }))}
              />
            )
          })}
        </div>
      </div>

      {mapping.entryType && (
        <div className="mapper-card">
          <h3>Entry Type Classifier</h3>
          {uniqueEntryTypeValues.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No values found in selected column.</div>
          ) : (
            <div className="mapper-grid">
              {uniqueEntryTypeValues.map((v) => (
                <label key={v} className="mapper-field">
                  <span>{v}</span>
                  <select
                    value={entryTypeMap[v] ?? ENTRY_TYPES.IGNORE}
                    onChange={(e) => setEntryTypeMap(m => ({ ...m, [v]: e.target.value }))}
                  >
                    {ENTRY_TYPE_LABELS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {showGlobalSettings && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 10 }}>Global Settings</h3>
          <div className="mapper-grid">
            <label className="mapper-field">
              <span>Reconciliation Date</span>
              <input type="date" value={recoDate} onChange={(e) => setRecoDate?.(e.target.value)} />
            </label>
            <label className="mapper-field">
              <span>Party Name</span>
              <input type="text" value={partyName} onChange={(e) => setPartyName?.(e.target.value)} placeholder="Customer / Party" />
            </label>
          </div>
        </div>
      )}

      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" onClick={confirm}>Confirm Mapping</button>
      </div>
    </div>
  )
}

