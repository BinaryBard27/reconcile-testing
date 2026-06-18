import * as XLSX from 'xlsx'

export function exportReconciliation(
  results, 
  summary, 
  qualityIssues, 
  partyName, 
  recoDate,
  remarks,
  actionStatuses,
  ourOpeningBalance,
  partyOpeningBalance,
  ourRows,
  partyRows
) {
  const finalPartyName = partyName || 'Party'
  let finalRecoDate = recoDate
  if (!finalRecoDate) {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    finalRecoDate = `${y}-${m}-${day}`
  }

  const wb = XLSX.utils.book_new()

  // Helper to format date
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : ''

  // -----------------------------------------------------
  // SHEET 1: Summary
  // -----------------------------------------------------
  const summaryData = [
    [`LEDGER RECONCILIATION — ${finalPartyName}`],
    [`As on: ${finalRecoDate}`],
    [],
    ['RECONCILIATION STATEMENT', 'Amount (₹)'],
    ['Balance as per Party Books', summary.partyNetBalance],
    ['Add: Invoices not in Party Books', summary.invoicesNotInParty],
    ['Add: TDS booked by Party (pending in our books)', summary.tdsExplicitGap],
    ['Add: TDS detected via amount mismatch', summary.tdsFromMismatch],
    ['Less: Invoices not in Our Books', -Math.abs(summary.invoicesNotInOurs)],
    ['Less: Amount Differences', -Math.abs(summary.amountDifferences)],
    ['Derived Balance', summary.derivedBalance],
    ['Balance as per Our Books', summary.ourNetBalance],
    ['Difference', summary.finalDifference],
    [],
    ['STATUS BREAKDOWN', 'Count'],
    ['Matched', summary.matched],
    ['TDS Deductions', summary.tdsFlagged],
    ['Missing in Party', summary.missingInParty],
    ['Missing in Our Books', summary.missingInOurs],
    ['Amount Mismatches', summary.mismatch],
    ['Possible Matches', summary.possible],
  ]

  if (ourOpeningBalance?.length || partyOpeningBalance?.length) {
    summaryData.push([])
    summaryData.push(['OPENING BALANCES', ''])
    summaryData.push(['Our Books Opening Balance', summary.ourOB])
    summaryData.push(['Party Books Opening Balance', summary.partyOB])
    summaryData.push(['Difference', summary.ourOB - summary.partyOB])
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

  // -----------------------------------------------------
  // SHEET 2: Invoice Reconciliation
  // -----------------------------------------------------
  const invHeaders = [
    'Reference No',
    'Our Date',
    'Our Amount (INR)',
    'Our Amount (USD)',
    'Our Narration',
    'Party Date',
    'Party Amount',
    'Party Narration',
    'Difference',
    'TDS Section',
    'TDS Amount',
    'Match Status',
    'Action Status',
    'Remarks',
  ]
  const invRows = (results ?? []).map((r, idx) => {
    const key = r.rowKey || r.refNo || String(idx)
    return [
      r.rawRefNo || r.refNo,
      fmtDate(r.ourDate),
      r.ourAmount || '',
      r.ourAmountUSD || '',
      r.ourNarration,
      fmtDate(r.partyDate),
      r.partyAmount || '',
      r.partyNarration,
      r.difference,
      r.tdsSection || '',
      r.actualDeduction || '',
      r.status,
      (actionStatuses || {})[key] || 'Open',
      (remarks || {})[r.refNo] || r.remarks || '',
    ]
  })
  const ws2 = XLSX.utils.aoa_to_sheet([invHeaders, ...invRows])
  XLSX.utils.book_append_sheet(wb, ws2, 'Invoice Reconciliation')

  // -----------------------------------------------------
  // SHEET 3: TDS Register
  // -----------------------------------------------------
  const tdsHeaders = [
    'Reference No',
    'Invoice Amount',
    'Narration',
    'TDS Section',
    'TDS Rate %',
    'Expected TDS',
    'Actual Deduction',
    'Difference',
    'Status'
  ]
  
  const tdsResults = (results ?? []).filter(r => String(r.status).startsWith('TDS'))
  const tdsRows = tdsResults.map(r => [
    r.rawRefNo || r.refNo,
    r.ourAmount,
    r.ourNarration,
    r.tdsSection || '',
    r.tdsRate ? (r.tdsRate * 100).toFixed(2) + '%' : '',
    r.expectedTDS || '',
    r.actualDeduction || '',
    (r.expectedTDS || 0) - (r.actualDeduction || 0),
    r.status
  ])
  
  // Footer row for TDS
  const totalExpTDS = tdsResults.reduce((s, r) => s + (r.expectedTDS || 0), 0)
  const totalActTDS = tdsResults.reduce((s, r) => s + (r.actualDeduction || 0), 0)
  tdsRows.push([
    'TOTAL', '', '', '', '', totalExpTDS, totalActTDS, totalExpTDS - totalActTDS, ''
  ])

  // Explicit TDS Entries Booked
  tdsRows.push([])
  tdsRows.push(['EXPLICIT TDS ENTRIES BOOKED'])
  tdsRows.push(['Source (Our/Party)', 'Date', 'Reference', 'Amount', 'Narration'])
  
  ;(ourRows || []).filter((r: any) => r.entryType === 'tds').forEach((r: any) => {
    tdsRows.push(['Our Books', fmtDate(r.date), r.refNo || '', Math.abs(r.amount), r.narration || ''])
  })
  
  ;(partyRows || []).filter((r: any) => r.entryType === 'tds').forEach((r: any) => {
    tdsRows.push(['Party Books', fmtDate(r.date), r.refNo || '', Math.abs(r.amount), r.narration || ''])
  })

  const ws3 = XLSX.utils.aoa_to_sheet([tdsHeaders, ...tdsRows])
  XLSX.utils.book_append_sheet(wb, ws3, 'TDS Register')

  // -----------------------------------------------------
  // SHEET 4: Payment Reconciliation
  // -----------------------------------------------------
  const payHeaders = ['Date', 'Amount', 'Narration/UTR', 'Source (Our/Party)', 'Notes']
  const payRows = []
  
  ;(ourRows || []).filter(r => r.entryType === 'payment').forEach(r => {
    payRows.push([fmtDate(r.date), Math.abs(r.amount), r.utr || r.narration || '', 'Our Books', 'Payment Received'])
  })
  
  ;(partyRows || []).filter(r => r.entryType === 'payment').forEach(r => {
    payRows.push([fmtDate(r.date), Math.abs(r.amount), r.utr || r.narration || '', 'Party Books', 'Payment Made'])
  })

  // Header section for Payments
  const paymentData = [
    ['PAYMENT RECONCILIATION'],
    [`Our Books — Total Payments Received: ₹ ${summary.ourPaymentTotal}`],
    [`Party Books — Total Payments Made: ₹ ${summary.partyPaymentTotal}`],
    [`Difference: ₹ ${Math.abs(summary.ourPaymentTotal - summary.partyPaymentTotal)}`],
    [],
    payHeaders,
    ...payRows
  ]

  const ws4 = XLSX.utils.aoa_to_sheet(paymentData)
  XLSX.utils.book_append_sheet(wb, ws4, 'Payment Reconciliation')

  // -----------------------------------------------------
  // SHEET 5: Data Quality
  // -----------------------------------------------------
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

  if (ourOpeningBalance?.length || partyOpeningBalance?.length) {
    qaRows.push(['', '', '', ''])
    qaRows.push(['OPENING BALANCE ROWS DETECTED', '', '', ''])
    ourOpeningBalance?.forEach(r => {
      qaRows.push(['Our Books', 'Opening Balance', r.refNo || '-', `Amount: ${r.amount}, Narration: ${r.narration}`])
    })
    partyOpeningBalance?.forEach(r => {
      qaRows.push(['Party Books', 'Opening Balance', r.refNo || '-', `Amount: ${r.amount}, Narration: ${r.narration}`])
    })
  }

  const ws5 = XLSX.utils.aoa_to_sheet([qaHeaders, ...qaRows])
  XLSX.utils.book_append_sheet(wb, ws5, 'Data Quality')

  // Formatting all sheets
  const sheets = [ws1, ws2, ws3, ws4, ws5]
  sheets.forEach(ws => {
    // Basic auto-sizing
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    ws['!cols'] = []
    for (let i = range.s.c; i <= range.e.c; ++i) {
      ws['!cols'][i] = { wch: 20 }
    }
  })

  const safeParty = String(finalPartyName).replace(/[^\w.-]+/g, '_')
  XLSX.writeFile(wb, `LedgerMatch_${safeParty}_${finalRecoDate}.xlsx`)
}


