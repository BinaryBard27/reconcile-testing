export function normalizeRef(ref) {
  if (!ref && ref !== 0) return ''
  return String(ref)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-_/\\]/g, '')
    .replace(/\.0+$/, '') // handle 246779414223.0 from Excel
    .replace(/^0+(?=\d)/, '') // strip leading zeros only if followed by digit
}

export function normalizeAmount(val) {
  if (val === null || val === undefined || val === '') return 0
  const num = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(num) ? 0 : Math.abs(num)
}

export function parseDate(val) {
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

export function detectDuplicates(rows) {
  // rows: array of { refNo, amount, date, ... }
  const groups: Record<string, any[]> = {}
  rows.forEach((row, idx) => {
    if (!row.refNo) return
    if (!groups[row.refNo]) groups[row.refNo] = []
    groups[row.refNo].push({ ...row, originalIndex: idx })
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

export function normalizeRows(rawRows, mapping, entryTypeMap, mappingConfig = { amountLogic: 'signed' }) {
  // rawRows: parsed CSV/Excel rows (array of objects)
  // mapping: { refNo, entryType, date, debitAmount, creditAmount, amountINR, ... }
  // entryTypeMap: { 'DR': 'invoice', 'DZ': 'payment', ... }
  
  const logic = mappingConfig?.amountLogic || 'signed'

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
      
      if (logic === 'separate' && mapping.debitAmount && mapping.creditAmount) {
        const debit = normalizeAmount(row?.[mapping.debitAmount])
        const credit = normalizeAmount(row?.[mapping.creditAmount])
        
        // Infer entryType from separate columns if not explicitly mapped
        if (!mapping.entryType) {
          entryType = debit > 0 ? 'invoice' : (credit > 0 ? 'payment' : 'ignore')
        }
        
        amount = entryType === 'invoice' ? debit : credit
        if (amount === 0) amount = debit || credit
      } else if (mapping.amountINR) {
        const rawVal = row?.[mapping.amountINR]
        const num = parseFloat(String(rawVal).replace(/,/g, ''))
        const rawAmt = isNaN(num) ? 0 : num
        amount = Math.abs(rawAmt)
        
        // Infer entryType from sign if not explicitly mapped
        if (!mapping.entryType) {
          entryType = rawAmt < 0 ? 'payment' : 'invoice'
        }
      }

      if (entryType === 'ignore') return null

      const amountUSD = mapping.amountUSD ? normalizeAmount(row?.[mapping.amountUSD]) : 0

      return {
        originalIndex: idx,
        refNo: normalizeRef(row?.[mapping.refNo]),
        rawRefNo: row?.[mapping.refNo],
        entryType,
        date: parseDate(row?.[mapping.date]),
        amount,
        amountUSD,
        narration: row?.[mapping.narration] || '',
        utr: mapping.utr ? row?.[mapping.utr] || '' : '',
        clearedStatus: mapping.clearedStatus ? row?.[mapping.clearedStatus] || '' : '',
        rawRow: row,
      }
    })
    .filter(Boolean)
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
runSelfTest()
