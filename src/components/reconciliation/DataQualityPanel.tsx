function Line({ tone, children }) {
  const color =
    tone === 'red' ? 'var(--red)' : tone === 'orange' ? 'var(--orange)' : tone === 'blue' ? 'var(--blue)' : 'var(--text)'
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color }}>
      <div style={{ width: 18, textAlign: 'center', marginTop: 1 }}>
        {tone === 'red' ? '🔴' : tone === 'orange' ? '🟠' : tone === 'blue' ? '🔵' : '•'}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function renderIssues(label, issues) {
  const lines = []

  if (issues.noReference > 0) {
    lines.push(
      <Line key={`${label}-noref`} tone="red">
        {issues.noReference} rows have no reference number
      </Line>
    )
  }

  const exportDups = issues.duplicates?.EXPORT_ERROR ?? []
  if (exportDups.length > 0) {
    const refs = exportDups.slice(0, 5).map((d) => d.ref).join(', ')
    lines.push(
      <Line key={`${label}-export`} tone="orange">
        {exportDups.length} refs appear to be export duplicates (auto-removed): {refs}
        {exportDups.length > 5 ? '…' : ''}
      </Line>
    )
  }

  const conflicts = issues.duplicates?.CONFLICT ?? []
  if (conflicts.length > 0) {
    const first = conflicts[0]
    lines.push(
      <Line key={`${label}-conflict`} tone="red">
        {conflicts.length} duplicate refs with conflicting amounts. Example: {first.ref} ({(first.amounts ?? []).join(' vs ')})
      </Line>
    )
  }

  const installments = issues.duplicates?.INSTALLMENT ?? []
  if (installments.length > 0) {
    lines.push(
      <Line key={`${label}-install`} tone="blue">
        {installments.length} refs repeat with same amount (possible installments / split booking).
      </Line>
    )
  }

  if (issues.unclassified > 0) {
    lines.push(
      <Line key={`${label}-unclass`} tone="orange">
        {issues.unclassified} rows are classified as Ignore via entry type mapping
      </Line>
    )
  }

  if (lines.length === 0) {
    lines.push(
      <Line key={`${label}-ok`} tone="blue">
        No major issues detected.
      </Line>
    )
  }

  return lines
}

export default function DataQualityPanel({ ourIssues, partyIssues, onProceed, onFix }) {
  return (
    <div>
      <header className="app-header">
        <h1>Data Quality</h1>
        <p>We found a few issues that can affect matching. Export duplicates will be auto-removed before reconciliation.</p>
      </header>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>⚠️ Data Quality Issues Found</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Our Books</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {renderIssues('our', ourIssues)}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Customer Books</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {renderIssues('party', partyIssues)}
            </div>
          </div>
        </div>
      </div>

      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onFix}>
          Fix Issues First
        </button>
        <button type="button" className="btn btn-primary" onClick={onProceed}>
          Proceed to Reconciliation
        </button>
      </div>
    </div>
  )
}

