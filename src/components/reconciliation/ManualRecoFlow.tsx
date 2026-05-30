import { useMemo, useState } from 'react'
import ColumnMapper from './ColumnMapper'
import DataQualityPanel from './DataQualityPanel'
import { exportReconciliation } from './ExportEngine'
import FileUpload from './FileUpload'
import { detectDuplicates, normalizeRows, normalizeRef } from './NormalizationEngine'
import { buildSummary, reconcileInvoices } from './ReconciliationEngine'
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

export default function ManualRecoFlow({ onBack }: { onBack: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)

  const [ourRawRows, setOurRawRows] = useState<any>(null)
  const [ourHeaders, setOurHeaders] = useState<any>(null)
  const [partyRawRows, setPartyRawRows] = useState<any>(null)
  const [partyHeaders, setPartyHeaders] = useState<any>(null)

  const [ourNormalized, setOurNormalized] = useState<any>(null)
  const [partyNormalized, setPartyNormalized] = useState<any>(null)
  const [ourIssues, setOurIssues] = useState<any>(null)
  const [partyIssues, setPartyIssues] = useState<any>(null)

  const [results, setResults] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)

  const [partyName, setPartyName] = useState('')
  const [recoDate, setRecoDate] = useState(todayISO())
  const [currency, setCurrency] = useState('INR')

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
    setOurNormalized(norm)
    setOurIssues(buildIssues({ rawRows: ourRawRows, mapping, entryTypeMap, normalizedRows: norm }))
    setStepIndex(2)
  }

  function onPartyMappingComplete(mapping: any, entryTypeMap: any, mappingConfig: any) {
    const norm = normalizeRows(partyRawRows, mapping, entryTypeMap, mappingConfig)
    setPartyNormalized(norm)
    setPartyIssues(buildIssues({ rawRows: partyRawRows, mapping, entryTypeMap, normalizedRows: norm }))
    setStepIndex(4)
  }

  function proceedToReconciliation() {
    const ourDupMap = detectDuplicates(ourNormalized ?? [])
    const partyDupMap = detectDuplicates(partyNormalized ?? [])
    const cleanOur = autoRemoveExportDuplicates(ourNormalized ?? [], ourDupMap)
    const cleanParty = autoRemoveExportDuplicates(partyNormalized ?? [], partyDupMap)
    const res = reconcileInvoices(cleanOur, cleanParty)
    const sum = buildSummary(res, cleanOur, cleanParty)
    setResults(res)
    setSummary(sum)
    setStepIndex(5)
  }

  function handleExport(viewRows: any, remarksByRef: any) {
    const merged = (viewRows ?? results ?? []).map((r: any) => ({
      ...r,
      refNo: normalizeRef(r.refNo),
      remarks: remarksByRef?.[r.refNo] ?? r.remarks ?? '',
    }))
    exportReconciliation(merged, summary, qualityIssues, partyName || 'Party', recoDate || todayISO())
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={onBack}>Back to Hub</button>
      </div>

      <ProgressBar stepIndex={stepIndex} />

      {stepIndex === 0 && (
        <div className="card">
          <h2>Step 1: Upload Our Books</h2>
          <FileUpload onFileLoaded={handleOurFileLoaded} />
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
          <FileUpload onFileLoaded={handlePartyFileLoaded} />
        </div>
      )}

      {stepIndex === 3 && (
        <ColumnMapper
          headers={partyHeaders ?? []}
          rawRows={partyRawRows ?? []}
          fileLabel="Customer Books"
          onMappingComplete={onPartyMappingComplete}
          partyName={partyName} // Pass party name so cache works
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
        <ResultsTable
          results={results}
          summary={summary}
          partyName={partyName}
          recoDate={recoDate}
          onExport={handleExport}
        />
      )}
    </div>
  )
}
