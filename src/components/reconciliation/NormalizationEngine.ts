export function normalizeRef(ref: unknown) {
  if (!ref && ref !== 0) return ''
  return String(ref)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-_/\\]/g, '')
    .replace(/\.0+$/, '') // handle 246779414223.0 from Excel
    .replace(/^0+(?=\d)/, '') // strip leading zeros only if followed by digit
}

export function normalizeAmount(val: unknown) {
  if (val === null || val === undefined || val === '') return 0
  const num = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(num) ? 0 : Math.abs(num)
}

export function parseDate(val: unknown) {
  if (!val) return null
  if (val instanceof Date) return val

  const s = String(val).trim()

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoMatch) return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3])

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1])

  // Excel serial number
  const serial = parseFloat(s)
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export function detectDuplicates(rows: any[]) {
  // rows: array of { refNo, amount, date, ... }
  const invoiceRows = rows.filter((r: any) => r.entryType === 'invoice' || r.entryType === 'credit_note')

  const groups: Record<string, any[]> = {}
  invoiceRows.forEach((row: any, idx: number) => {
    if (!row.refNo) return
    if (!groups[row.refNo]) groups[row.refNo] = []
    groups[row.refNo].push({ ...row, originalIndex: row.originalIndex ?? idx })
  })

  const duplicates = {}
  Object.entries(groups).forEach(([ref, group]) => {
    if (group.length < 2) return
    const amounts = [...new Set(group.map((r) => r.amount))]
    const dates = [...new Set(group.map((r) => String(r.date)))]

    if (amounts.length === 1 && dates.length === 1) {
      duplicates[ref] = { type: 'EXPORT_ERROR', rows: group }
    } else if (amounts.length === 1) {
      duplicates[ref] = { type: 'INSTALLMENT', rows: group }
    } else {
      duplicates[ref] = { type: 'CONFLICT', rows: group }
    }
  })
  return duplicates
}

function detectCurrencyFromHeader(header: string): 'INR' | 'USD' | 'EUR' | null {
  const h = (header || '').toUpperCase()
  if (h.includes('USD') || h.includes('$')) return 'USD'
  if (h.includes('EUR') || h.includes('€')) return 'EUR'
  if (h.includes('INR') || h.includes('₹') || h.includes('RS')) return 'INR'
  return null
}

export function normalizeRows(rawRows: any[], mapping: any, entryTypeMap: any, mappingConfig: any = { amountLogic: 'separate' }) {
  // rawRows: parsed CSV/Excel rows (array of objects)
  // mapping: { refNo, entryType, date, debitAmount, creditAmount, amountINR, ... }
  // entryTypeMap: { 'DR': 'invoice', 'DZ': 'payment', ... }
  
  const logic = mappingConfig?.amountLogic || 'separate'

  // Detect currency from column headers
  let primaryCurrency: 'INR' | 'USD' | 'EUR' = 'INR'
  if (mapping.amountINR) {
    const detected = detectCurrencyFromHeader(mapping.amountINR)
    if (detected) primaryCurrency = detected
  }
  if (mapping.debitAmount) {
    const detected = detectCurrencyFromHeader(mapping.debitAmount)
    if (detected) primaryCurrency = detected
  }

  // Check if USD column has data
  let hasUSDData = false
  if (mapping.amountUSD) {
    hasUSDData = (rawRows ?? []).some(row => {
      const val = normalizeAmount(row?.[mapping.amountUSD])
      return val > 0
    })
  }

  return (rawRows ?? [])
    .map((row, idx) => {
      let entryType = 'ignore'
      
      // Determine explicit entry type if mapped
      if (mapping.entryType) {
        const rawEntryType = row?.[mapping.entryType] || ''
        entryType = entryTypeMap[String(rawEntryType).trim()] || 'ignore'
      }

      // Amount: handle debit/credit columns or single amount column
      let amount = 0
      let debit = 0
      let credit = 0
      let rawAmt: number | undefined = undefined
      
      if (logic === 'separate' && mapping.debitAmount && mapping.creditAmount) {
        debit = normalizeAmount(row?.[mapping.debitAmount])
        credit = normalizeAmount(row?.[mapping.creditAmount])
        
        // Infer entryType from separate columns if not explicitly mapped
        if (!mapping.entryType) {
          entryType = debit > 0 ? 'invoice' : (credit > 0 ? 'payment' : 'ignore')
        }
        
        amount = entryType === 'invoice' ? debit : credit
        if (amount === 0) amount = debit || credit
      } else if (mapping.amountINR) {
        const rawVal = row?.[mapping.amountINR]
        const num = parseFloat(String(rawVal).replace(/,/g, ''))
        rawAmt = isNaN(num) ? 0 : num
        
        if (logic === 'doctype' && entryType !== 'ignore') {
          if (entryType === 'invoice') amount = Math.abs(rawAmt)
          else if (entryType === 'payment' || entryType === 'credit_note') amount = -Math.abs(rawAmt)
          else amount = rawAmt
        } else {
          amount = Math.abs(rawAmt)
        }
        
        // Infer entryType from sign if not explicitly mapped
        if (!mapping.entryType) {
          entryType = rawAmt < 0 ? 'payment' : 'invoice'
        }
      }

      if (!mapping.entryType) {
        // No entry type column mapped — infer from amount sign or default to invoice
        if (mapping.amountINR && rawAmt !== undefined) {
          entryType = rawAmt < 0 ? 'payment' : 'invoice'
        } else if (logic === 'separate') {
          entryType = debit > 0 ? 'invoice' : credit > 0 ? 'payment' : 'ignore'
        } else {
          entryType = 'invoice' // default to invoice if cannot determine
        }
      }

      if (entryType === 'ignore') return null

      const amountUSD = mapping.amountUSD ? normalizeAmount(row?.[mapping.amountUSD]) : 0

      // Determine detected currency for this row
      let detectedCurrency: 'INR' | 'USD' | 'EUR' = primaryCurrency
      if (hasUSDData && amountUSD > 0) {
        detectedCurrency = 'USD'
      }

      return {
        originalIndex: idx,
        refNo: normalizeRef(row?.[mapping.refNo]),
        rawRefNo: row?.[mapping.refNo],
        entryType,
        date: parseDate(row?.[mapping.date]),
        amount,
        amountINR: primaryCurrency === 'INR' ? amount : 0,
        amountUSD,
        detectedCurrency,
        narration: row?.[mapping.narration] || '',
        utr: mapping.utr ? row?.[mapping.utr] || '' : '',
        clearedStatus: mapping.clearedStatus ? row?.[mapping.clearedStatus] || '' : '',
        rawRow: row,
      }
    })
    .filter(Boolean)
}

export type NormalizedRow = any

export function separateOpeningBalance(rows: NormalizedRow[]) {
  const openingKeywords = [
    'opening', 'op bal', 'op.bal', 'o/b', 'ob ', 
    'brought forward', 'b/f', 'balance b/d', 'balance brought'
  ]
  
  const isOpeningBalance = (row: NormalizedRow) => {
    if (row.entryType !== 'invoice') return false
    const narr = String(row.narration || '').toLowerCase()
    const hasKeyword = openingKeywords.some(k => narr.includes(k))
    return hasKeyword
  }

  const openingBalanceRows = rows.filter(isOpeningBalance)
  const transactionRows = rows.filter(r => !isOpeningBalance(r))

  return { openingBalanceRows, transactionRows }
}

function runSelfTest() {
  const refs = [
    '246779414223.0',
    'INV-001',
    'INV001',
    '001',
    '1',
    '256779418476',
    ' 256779418476 ',
  ]
  refs.forEach((r) => console.log(`"${r}" \u2192 "${normalizeRef(r)}"`))

  console.log(parseDate('2025-07-23 00:00:00')) // SAP ISO format
  console.log(parseDate('31/03/2025')) // Tally format
  console.log(parseDate('2025-03-31')) // Clean ISO
}
if (import.meta.env.DEV) runSelfTest()
