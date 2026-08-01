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

  if (issues.deliberateIgnore > 0) {
    lines.push(
      <Line key={`${label}-unclass`} tone="orange">
        {issues.deliberateIgnore} rows deliberately set to Ignore
      </Line>
    )
  }

  if (issues.unrecognized > 0) {
    lines.push(
      <Line key={`${label}-unrecognized`} tone="red">
        {issues.unrecognized} rows excluded because the format couldn't be recognized
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

export default function DataQualityPanel({
  ourIssues, partyIssues, ourExcludedPct = 0, ourExcludedRows = 0,
  partyExcludedPct = 0, partyExcludedRows = 0,
  ourInvoiceCount, partyInvoiceCount, onProceed, onFix,
}) {
  const ourTooMuchExcluded = ourExcludedPct > 0.3
  const partyTooMuchExcluded = partyExcludedPct > 0.3
  const blockProceed = partyInvoiceCount === 0 || ourTooMuchExcluded || partyTooMuchExcluded

  function renderExclusionAlert(label, issues) {
    const pct = issues?.excludedPct ?? 0
    if (pct <= 0.1) return null
    const blocking = pct > 0.3
    return (
      <div className="card" style={{ marginBottom: 20, borderColor: blocking ? 'var(--red)' : 'var(--orange)' }}>
        <Line tone={blocking ? 'red' : 'orange'}>
          <strong>
            {blocking ? `⚠️ Over 30% of ${label} could not be classified.` : `⚠️ Over 10% of ${label} may be incomplete.`}
          </strong>
          <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
            Go back to the mapping step and manually assign an entry type to each unrecognized value {blocking ? 'before proceeding — otherwise the reconciliation result will be missing most of this file’s data.' : 'before proceeding — otherwise the reconciliation result may be incomplete.'}
          </div>
        </Line>
      </div>
    )
  }

  return (
    <div>
      <header className="app-header">
        <h1>Data Quality</h1>
        <p>We found a few issues that can affect matching. Export duplicates will be auto-removed before reconciliation.</p>
      </header>

      {blockProceed && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--red)' }}>
          <Line tone="red">
            <div>
              <strong>⚠️ No invoice rows found in Customer Books.</strong>
              <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
                All rows are classified as Ignore or no entry type was mapped.
                Go back to Map Customer and check:
                <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                  <li>Entry Type column is mapped and classified correctly</li>
                  <li>OR Entry Type is left unmapped and Debit/Credit columns have values</li>
                </ul>
              </div>
            </div>
          </Line>
        </div>
      )}

      {renderExclusionAlert('Our Books', { ...ourIssues, excludedPct: ourExcludedPct, excludedRows: ourExcludedRows })}
      {renderExclusionAlert('Customer Books', { ...partyIssues, excludedPct: partyExcludedPct, excludedRows: partyExcludedRows })}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12 }}>⚠️ Data Quality Issues Found</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Our Books ({ourInvoiceCount ?? 0} invoices)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {renderIssues('our', ourIssues)}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Customer Books ({partyInvoiceCount ?? 0} invoices)</div>
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
        {!blockProceed && (
          <button type="button" className="btn btn-primary" onClick={onProceed}>
            Proceed to Reconciliation
          </button>
        )}
      </div>
    </div>
  )
}
