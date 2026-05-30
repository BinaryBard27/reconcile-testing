import * as XLSX from 'xlsx'

export function exportResultsToExcel({ results, ledgerRows, statementRows, fileNameBase = 'ledger-match' }) {
  const workbook = XLSX.utils.book_new()

  const flatResults = (results ?? []).map((r) => ({
    Status: r.status,
    Confidence: typeof r.confidence === 'number' ? Number(r.confidence.toFixed(3)) : '',
    Reason: r.reason ?? '',

    LedgerDate: r.ledgerDate ?? '',
    LedgerAmount: r.ledgerAmount ?? '',
    LedgerReference: r.ledger?.referenceRaw ?? '',
    LedgerDescription: r.ledgerDescription ?? '',

    StatementDate: r.statementDate ?? '',
    StatementAmount: r.statementAmount ?? '',
    StatementReference: r.statement?.referenceRaw ?? '',
    StatementDescription: r.statementDescription ?? '',
  }))

  const resultsSheet = XLSX.utils.json_to_sheet(flatResults)
  XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Results')

  const ledgerSheet = XLSX.utils.json_to_sheet(
    (ledgerRows ?? []).map((r) => ({
      Date: r.date,
      Amount: r.amount,
      Reference: r.referenceRaw,
      Description: r.description,
    }))
  )
  XLSX.utils.book_append_sheet(workbook, ledgerSheet, 'Ledger')

  const statementSheet = XLSX.utils.json_to_sheet(
    (statementRows ?? []).map((r) => ({
      Date: r.date,
      Amount: r.amount,
      Reference: r.referenceRaw,
      Description: r.description,
    }))
  )
  XLSX.utils.book_append_sheet(workbook, statementSheet, 'Statement')

  XLSX.writeFile(workbook, `${fileNameBase}.xlsx`)
}

