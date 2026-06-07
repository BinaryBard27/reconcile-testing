import { useState } from 'react'
import FileUpload from './FileUpload'
import { detectFormatAndSuggestMapping } from './autoDetect'
import { detectDuplicates, normalizeRows } from './NormalizationEngine'
import { buildSummary, reconcileInvoices } from './ReconciliationEngine'
import ResultsTable from './ResultsTable'
import { exportReconciliation } from './ExportEngine'

function autoRemoveExportDuplicates(rows: any[], duplicatesMap: any) {
  const exportRefs = new Set(
    Object.entries(duplicatesMap || {})
      .filter(([, v]: any) => v?.type === 'EXPORT_ERROR')
      .map(([ref]) => ref)
  )
  if (exportRefs.size === 0) return rows

  const seen = new Set()
  const out = []
  for (const r of rows || []) {
    if (!r.refNo) { out.push(r); continue }
    if (!exportRefs.has(r.refNo)) { out.push(r); continue }
    if (seen.has(r.refNo)) continue
    seen.add(r.refNo)
    out.push(r)
  }
  return out
}

export default function AutoRecoFlow({ onBack }: { onBack: () => void }) {
  const [ourRaw, setOurRaw] = useState<any[] | null>(null)
  const [partyRaw, setPartyRaw] = useState<any[] | null>(null)
  
  const [results, setResults] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')

  function handleFileLoaded(fileKey: string, parsedRows: any[], headers: string[]) {
    if (fileKey === 'our') setOurRaw(parsedRows)
    else setPartyRaw(parsedRows)

    const nextOur = fileKey === 'our' ? parsedRows : ourRaw
    const nextParty = fileKey === 'party' ? parsedRows : partyRaw

    if (nextOur && nextParty) {
      runAutoReco(nextOur, headers, nextParty, headers) // We need both headers, wait. 
      // FileUpload gives us headers but doesn't pass it here easily unless we store it.
    }
  }
  
  // Need to correctly capture headers
  const [ourHeaders, setOurHeaders] = useState<string[]>([])
  const [partyHeaders, setPartyHeaders] = useState<string[]>([])

  function handleFileLoadedWrapper(fileKey: string, parsedRows: any[], headers: string[]) {
    if (fileKey === 'our') {
      setOurRaw(parsedRows)
      setOurHeaders(headers)
    } else {
      setPartyRaw(parsedRows)
      setPartyHeaders(headers)
    }
  }

  function runAutoRecoAttempt() {
    if (!ourRaw || !partyRaw) return
    runAutoReco(ourRaw, ourHeaders, partyRaw, partyHeaders)
  }

  function runAutoReco(ourData: any[], ourH: string[], partyData: any[], partyH: string[]) {
    setError('')
    try {
      const ourSuggest = detectFormatAndSuggestMapping(ourH, ourData)
      const partySuggest = detectFormatAndSuggestMapping(partyH, partyData)

      if (!ourSuggest.suggestion.date || !partySuggest.suggestion.date) {
        throw new Error("Could not auto-detect Date column in one or both files. Please use Manual Reco.")
      }

      const ourNorm = normalizeRows(ourData, ourSuggest.suggestion, {}, { amountLogic: ourSuggest.suggestion.amountLogic })
      const partyNorm = normalizeRows(partyData, partySuggest.suggestion, {}, { amountLogic: partySuggest.suggestion.amountLogic })

      const cleanOur = autoRemoveExportDuplicates(ourNorm, detectDuplicates(ourNorm))
      const cleanParty = autoRemoveExportDuplicates(partyNorm, detectDuplicates(partyNorm))

      const res = reconcileInvoices(cleanOur, cleanParty)
      const sum = buildSummary(res, cleanOur, cleanParty)

      setResults(res)
      setSummary(sum)
    } catch (e: any) {
      setError(e.message || "Auto-reco failed. Please try Manual Reco.")
    }
  }

  if (results && summary) {
    return (
      <div className="card">
        <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 16 }}>Back to Hub</button>
        <ResultsTable
          results={results}
          summary={summary}
          partyName="Auto_Detected_Party"
          recoDate={new Date().toISOString().split('T')[0]}
          onExport={() => exportReconciliation(results, summary, {}, 'Auto_Detected_Party', new Date().toISOString().split('T')[0])}
        />
      </div>
    )
  }

  return (
    <div className="card">
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 16 }}>Back</button>
      <h2>Auto Reconciliation</h2>
      <p>Upload your books and the party's books. We will automatically detect the formats, map the columns, and reconcile.</p>
      
      {error && <div className="tool-result warn" style={{ marginBottom: 16 }}>{error}</div>}

      <FileUpload onFileLoaded={handleFileLoadedWrapper} />
      
      <div style={{ marginTop: 20 }}>
        <button 
          className="btn btn-primary" 
          onClick={runAutoRecoAttempt} 
          disabled={!ourRaw || !partyRaw}
        >
          Run Auto Reco
        </button>
      </div>
    </div>
  )
}
