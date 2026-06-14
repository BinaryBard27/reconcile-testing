import { useMemo, useState } from 'react'
import ColumnMapper from './ColumnMapper'
import DataQualityPanel from './DataQualityPanel'
import { exportReconciliation } from './ExportEngine'
import FileUpload from './FileUpload'
import { detectDuplicates, normalizeRows, separateOpeningBalance } from './NormalizationEngine'
import { buildDetailedSummary, reconcileInvoices } from './ReconciliationEngine'
import ResultsTable from './ResultsTable'

const STEPS = [
  { key: 'UPLOAD_OUR', label: 'Upload Our Books' },
  { key: 'MAP_OUR', label: 'Map Our Books' },
  { key: 'UPLOAD_PARTY', label: 'Upload Customer' },
  { key: 'MAP_PARTY', label: 'Map Customer' },
  { key: 'QUALITY', label: 'Data Quality' },
  { key: 'RESULTS', label: 'Results' },
]

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ProgressBar({ stepIndex }: { stepIndex: number }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {STEPS.map((s, idx) => {
          const active = idx === stepIndex
          const done = idx < stepIndex
          return (
            <div
              key={s.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                borderRadius: 999, border: '1px solid var(--border-light)',
                background: active ? 'var(--accent-light)' : 'var(--bg-elevated)',
                color: active ? 'var(--text-h)' : 'var(--text-muted)',
                fontSize: '0.78rem', fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 999, background: done ? 'var(--green)' : active ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                  color: done || active ? '#0b1220' : 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 900, flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              {s.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildIssues({ rawRows, mapping, entryTypeMap, normalizedRows }: any) {
  const noReference = (normalizedRows ?? []).filter((r: any) => !r.refNo).length
  const duplicatesRaw = detectDuplicates(normalizedRows ?? [])
  const dups = { EXPORT_ERROR: [] as any[], CONFLICT: [] as any[], INSTALLMENT: [] as any[] }
  Object.entries(duplicatesRaw as Record<string, any>).forEach(([ref, info]) => {
    if (info.type === 'EXPORT_ERROR') dups.EXPORT_ERROR.push({ ref, count: info.rows.length })
    else if (info.type === 'CONFLICT')
      dups.CONFLICT.push({
        ref, count: info.rows.length, amounts: [...new Set(info.rows.map((r: any) => r.amount))],
      })
    else if (info.type === 'INSTALLMENT') dups.INSTALLMENT.push({ ref, count: info.rows.length })
  })

  let unclassified = 0
  if (mapping?.entryType) {
    for (const r of rawRows ?? []) {
      const raw = String(r?.[mapping.entryType] ?? '').trim()
      const cls = entryTypeMap?.[raw] ?? 'ignore'
      if (cls === 'ignore') unclassified++
    }
  }

  return { noReference, duplicates: dups, unclassified }
}

function autoRemoveExportDuplicates(rows: any[], duplicatesMap: any) {
  const exportRefs = new Set(Object.entries((duplicatesMap ?? {}) as Record<string, any>).filter(([, v]) => v?.type === 'EXPORT_ERROR').map(([ref]) => ref))
  if (exportRefs.size === 0) return rows
  const seen = new Set()
  const out = []
  for (const r of rows ?? []) {
    if (!r.refNo) { out.push(r); continue }
    if (!exportRefs.has(r.refNo)) { out.push(r); continue }
    if (seen.has(r.refNo)) continue
    seen.add(r.refNo); out.push(r)
  }
  return out
}

function EditMappingPanel({
  isOpen, onClose,
  ourHeaders, ourRawRows, partyHeaders, partyRawRows,
  partyName, onRerun,
}: any) {
  const [ourDone, setOurDone] = useState(false)
  const [partyDone, setPartyDone] = useState(false)
  const [ourMapping, setOurMapping] = useState<any>(null)
  const [ourEntryTypeMap, setOurEntryTypeMap] = useState<any>(null)
  const [ourMappingConfig, setOurMappingConfig] = useState<any>(null)
  const [partyMapping, setPartyMapping] = useState<any>(null)
  const [partyEntryTypeMap, setPartyEntryTypeMap] = useState<any>(null)
  const [partyMappingConfig, setPartyMappingConfig] = useState<any>(null)

  if (!isOpen) return null

  function handleOurMappingComplete(mapping: any, entryTypeMap: any, mappingConfig: any) {
    setOurMapping(mapping)
    setOurEntryTypeMap(entryTypeMap)
    setOurMappingConfig(mappingConfig)
    setOurDone(true)
  }

  function handlePartyMappingComplete(mapping: any, entryTypeMap: any, mappingConfig: any) {
    setPartyMapping(mapping)
    setPartyEntryTypeMap(entryTypeMap)
    setPartyMappingConfig(mappingConfig)
    setPartyDone(true)
  }

  function handleRerun() {
    if (ourDone && partyDone) {
      onRerun(ourMapping, ourEntryTypeMap, ourMappingConfig, partyMapping, partyEntryTypeMap, partyMappingConfig)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '680px', maxWidth: '100vw',
        background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        zIndex: 1000, overflowY: 'auto', padding: '24px',
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Mapping</h2>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Our Books Mapping</h3>
        <ColumnMapper
          headers={ourHeaders ?? []}
          rawRows={ourRawRows ?? []}
          fileLabel="Our Books"
          onMappingComplete={handleOurMappingComplete}
          partyName={partyName}
        />
        {ourDone && <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.85rem', marginTop: 8 }}>✓ Our Books mapping confirmed</div>}
      </div>

      <div style={{ marginBottom: 24, borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Customer Books Mapping</h3>
        <ColumnMapper
          headers={partyHeaders ?? []}
          rawRows={partyRawRows ?? []}
          fileLabel="Customer Books"
          onMappingComplete={handlePartyMappingComplete}
          partyName={partyName}
        />
        {partyDone && <div style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.85rem', marginTop: 8 }}>✓ Customer Books mapping confirmed</div>}
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '16px 0', borderTop: '1px solid var(--border)' }}>
        <button
          className="btn btn-primary"
          disabled={!ourDone || !partyDone}
          onClick={handleRerun}
          style={{ width: '100%' }}
        >
          Re-run Reconciliation
        </button>
      </div>
    </div>
  )
}

export default function ManualRecoFlow({ onBack }: { onBack: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)

  const [ourRawRows, setOurRawRows] = useState<any>(null)
  const [ourHeaders, setOurHeaders] = useState<any>(null)
  const [partyRawRows, setPartyRawRows] = useState<any>(null)
  const [partyHeaders, setPartyHeaders] = useState<any>(null)

  const [ourNormalized, setOurNormalized] = useState<any>(null)
  const [partyNormalized, setPartyNormalized] = useState<any>(null)
  const [ourOpeningBalance, setOurOpeningBalance] = useState<any[]>([])
  const [partyOpeningBalance, setPartyOpeningBalance] = useState<any[]>([])
  const [ourIssues, setOurIssues] = useState<any>(null)
  const [partyIssues, setPartyIssues] = useState<any>(null)

  const [results, setResults] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)

  const [partyName, setPartyName] = useState('')
  const [recoDate, setRecoDate] = useState(todayISO())
  const [currency, setCurrency] = useState('INR')

  const [editMappingOpen, setEditMappingOpen] = useState(false)

  const qualityIssues = useMemo(() => ({ our: ourIssues, party: partyIssues }), [ourIssues, partyIssues])

  function handleOurFileLoaded(fileKey: string, parsedRows: any, headers: any) {
    setOurRawRows(parsedRows)
    setOurHeaders(headers)
    setStepIndex(1)
  }

  function handlePartyFileLoaded(fileKey: string, parsedRows: any, headers: any) {
    setPartyRawRows(parsedRows)
    setPartyHeaders(headers)
    setStepIndex(3)
  }

  function onOurMappingComplete(mapping: any, entryTypeMap: any, mappingConfig: any) {
    const norm = normalizeRows(ourRawRows, mapping, entryTypeMap, mappingConfig)
    const { openingBalanceRows, transactionRows } = separateOpeningBalance(norm)
    setOurNormalized(transactionRows)
    setOurOpeningBalance(openingBalanceRows)
    setOurIssues(buildIssues({ rawRows: ourRawRows, mapping, entryTypeMap, normalizedRows: transactionRows }))
    setStepIndex(2)
  }

  function onPartyMappingComplete(mapping: any, entryTypeMap: any, mappingConfig: any) {
    const norm = normalizeRows(partyRawRows, mapping, entryTypeMap, mappingConfig)
    const { openingBalanceRows, transactionRows } = separateOpeningBalance(norm)
    setPartyNormalized(transactionRows)
    setPartyOpeningBalance(openingBalanceRows)
    setPartyIssues(buildIssues({ rawRows: partyRawRows, mapping, entryTypeMap, normalizedRows: transactionRows }))
    setStepIndex(4)
  }

  function proceedToReconciliation() {
    const ourDupMap = detectDuplicates(ourNormalized ?? [])
    const partyDupMap = detectDuplicates(partyNormalized ?? [])
    const cleanOur = autoRemoveExportDuplicates(ourNormalized ?? [], ourDupMap)
    const cleanParty = autoRemoveExportDuplicates(partyNormalized ?? [], partyDupMap)
    const res = reconcileInvoices(cleanOur, cleanParty)
    const sum = buildDetailedSummary(res, cleanOur, cleanParty, ourOpeningBalance, partyOpeningBalance)
    setResults(res)
    setSummary(sum)
    setStepIndex(5)
  }

  function handleRerunWithNewMapping(
    ourMapping: any, ourEntryTypeMap: any, ourMappingConfig: any,
    partyMapping: any, partyEntryTypeMap: any, partyMappingConfig: any
  ) {
    const ourNorm = normalizeRows(ourRawRows, ourMapping, ourEntryTypeMap, ourMappingConfig)
    const { openingBalanceRows: ourOB, transactionRows: ourTrans } = separateOpeningBalance(ourNorm)
    setOurNormalized(ourTrans)
    setOurOpeningBalance(ourOB)

    const partyNorm = normalizeRows(partyRawRows, partyMapping, partyEntryTypeMap, partyMappingConfig)
    const { openingBalanceRows: partyOB, transactionRows: partyTrans } = separateOpeningBalance(partyNorm)
    setPartyNormalized(partyTrans)
    setPartyOpeningBalance(partyOB)

    const cleanOur = autoRemoveExportDuplicates(ourTrans, detectDuplicates(ourTrans))
    const cleanParty = autoRemoveExportDuplicates(partyTrans, detectDuplicates(partyTrans))
    const res = reconcileInvoices(cleanOur, cleanParty)
    const sum = buildDetailedSummary(res, cleanOur, cleanParty, ourOB, partyOB)
    setResults(res)
    setSummary(sum)
    setEditMappingOpen(false)
  }

  function handleExport(viewRows: any, remarksByRef: any, actionStatuses: any) {
    exportReconciliation(
      results,
      summary,
      qualityIssues,
      partyName || 'Party',
      recoDate || todayISO(),
      remarksByRef,
      actionStatuses,
      ourOpeningBalance,
      partyOpeningBalance,
      ourNormalized,
      partyNormalized
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={onBack}>Back to Hub</button>
        {stepIndex > 0 && (
          <button className="btn btn-secondary" onClick={() => setStepIndex(stepIndex - 1)}>
            ← Previous Step
          </button>
        )}
      </div>

      <ProgressBar stepIndex={stepIndex} />

      {stepIndex === 0 && (
        <div className="card">
          <h2>Step 1: Upload Our Books</h2>
          <FileUpload onFileLoaded={handleOurFileLoaded} singleMode title="Upload Our Books" fileKey="our" />
        </div>
      )}

      {stepIndex === 1 && (
        <ColumnMapper
          headers={ourHeaders ?? []}
          rawRows={ourRawRows ?? []}
          fileLabel="Our Books"
          onMappingComplete={onOurMappingComplete}
          showGlobalSettings
          partyName={partyName} setPartyName={setPartyName}
          recoDate={recoDate} setRecoDate={setRecoDate}
          currency={currency} setCurrency={setCurrency}
        />
      )}

      {stepIndex === 2 && (
        <div className="card">
          <h2>Step 3: Upload Customer Books</h2>
          <FileUpload onFileLoaded={handlePartyFileLoaded} singleMode title="Upload Customer / Party Books" fileKey="party" />
        </div>
      )}

      {stepIndex === 3 && (
        <ColumnMapper
          headers={partyHeaders ?? []}
          rawRows={partyRawRows ?? []}
          fileLabel="Customer Books"
          onMappingComplete={onPartyMappingComplete}
          partyName={partyName}
        />
      )}

      {stepIndex === 4 && (
        <DataQualityPanel
          ourIssues={ourIssues ?? { noReference: 0, duplicates: {}, unclassified: 0 }}
          partyIssues={partyIssues ?? { noReference: 0, duplicates: {}, unclassified: 0 }}
          onFix={() => setStepIndex(3)}
          onProceed={proceedToReconciliation}
        />
      )}

      {stepIndex === 5 && results && summary && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditMappingOpen(true)}
              style={{ gap: 6 }}
            >
              ✏️ Edit Mapping
            </button>
          </div>
          <ResultsTable
            results={results}
            summary={summary}
            partyName={partyName}
            recoDate={recoDate}
            onExport={handleExport}
          />
          <EditMappingPanel
            isOpen={editMappingOpen}
            onClose={() => setEditMappingOpen(false)}
            ourHeaders={ourHeaders}
            ourRawRows={ourRawRows}
            partyHeaders={partyHeaders}
            partyRawRows={partyRawRows}
            partyName={partyName}
            onRerun={handleRerunWithNewMapping}
          />
        </div>
      )}
    </div>
  )
}
