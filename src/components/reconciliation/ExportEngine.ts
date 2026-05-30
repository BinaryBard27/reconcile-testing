import * as XLSX from 'xlsx'

export function exportReconciliation(results, summary, qualityIssues, partyName, recoDate) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryData = [
    [`Ledger Reconciliation — ${partyName}`],
    [`As on: ${recoDate}`],
    [],
    ['Particulars', 'Amount'],
    ['Total Invoiced (Our Books)', summary.ourTotal],
    ['Total Invoiced (Party Books)', summary.partyTotal],
    ['Net Difference', summary.netDifference],
    [],
    ['Invoices Not in Party Books', summary.missingInParty],
    ['Invoices Not in Our Books', summary.missingInOurs],
    ['Amount Mismatches', summary.amountMismatch],
    [],
    ['Reconciliation Status', ''],
    ['Matched', summary.matched],
    ['Total Rows', summary.totalRows],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

  // Sheet 2: Invoice Reconciliation
  const headers = [
    'Reference No',
    'Our Date',
    'Our Amount (INR)',
    'Our Amount (USD)',
    'Our Narration',
    'Party Date',
    'Party Amount',
    'Party Narration',
    'Difference',
    'Status',
    'Remarks',
  ]
  const rows = (results ?? []).map((r) => [
    r.rawRefNo || r.refNo,
    r.ourDate ? r.ourDate.toLocaleDateString('en-IN') : '',
    r.ourAmount || '',
    r.ourAmountUSD || '',
    r.ourNarration,
    r.partyDate ? r.partyDate.toLocaleDateString('en-IN') : '',
    r.partyAmount || '',
    r.partyNarration,
    r.difference,
    r.status,
    r.remarks,
  ])
  const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows])
  XLSX.utils.book_append_sheet(wb, ws2, 'Invoice Reconciliation')

  // Sheet 3: Data Quality
  const qaHeaders = ['File', 'Issue Type', 'Reference', 'Details']
  const qaRows = []
  const files = [
    ['Our Books', qualityIssues?.our],
    ['Party Books', qualityIssues?.party],
  ]
  files.forEach(([label, issues]) => {
    if (!issues) return
    if (issues.noReference > 0) qaRows.push([label, 'No Reference', '-', `${issues.noReference} rows`])
    issues.duplicates?.CONFLICT?.forEach((d) =>
      qaRows.push([label, 'Duplicate — Amount Conflict', d.ref, d.amounts?.join(' vs ')])
    )
    issues.duplicates?.EXPORT_ERROR?.forEach((d) =>
      qaRows.push([label, 'Duplicate — Export Error (auto-removed)', d.ref, `${d.count} occurrences`])
    )
  })
  const ws3 = XLSX.utils.aoa_to_sheet([qaHeaders, ...qaRows])
  XLSX.utils.book_append_sheet(wb, ws3, 'Data Quality')

  const safeParty = String(partyName || 'Party').replace(/[^\w.-]+/g, '_')
  XLSX.writeFile(wb, `LedgerMatch_${safeParty}_${recoDate}.xlsx`)
}

