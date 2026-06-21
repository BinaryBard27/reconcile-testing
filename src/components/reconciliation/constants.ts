export const ENTRY_TYPES = {
  INVOICE: 'invoice',
  PAYMENT: 'payment',
  CREDIT_NOTE: 'credit_note',
  TDS: 'tds',
  ADJUSTMENT: 'adjustment',
  IGNORE: 'ignore',
}

export const MATCH_STATUS = {
  MATCHED: 'Matched',
  AMOUNT_MISMATCH_UNDER: 'Amount Mismatch — Under-booked',
  AMOUNT_MISMATCH_OVER: 'Amount Mismatch — Over-booked',
  POSSIBLE_TYPO: 'Possible Match — Ref Typo',
  MATCHED_BY_AMOUNT_DATE: 'Matched by Amount/Date',
  MISSING_IN_PARTY: 'Missing in Customer Books',
  MISSING_IN_OURS: 'Missing in Our Books',
  DUPLICATE_EXPORT_ERROR: 'Duplicate Ref — Likely Export Error',
  DUPLICATE_CONFLICT: 'Duplicate Ref — Amount Conflict',
  TDS_DEDUCTION: 'TDS Deduction',
  TDS_MISMATCH: 'TDS Amount Mismatch',
  TDS_AND_FX: 'TDS + FX Difference',
  FX_ONLY: 'FX Difference (Exchange Gain/Loss)',
  MANUALLY_MATCHED: 'Manually Matched',
}

export const STATUS_COLORS = {
  [MATCH_STATUS.MATCHED]: '#22c55e',
  [MATCH_STATUS.AMOUNT_MISMATCH_UNDER]: '#f59e0b',
  [MATCH_STATUS.AMOUNT_MISMATCH_OVER]: '#f59e0b',
  [MATCH_STATUS.POSSIBLE_TYPO]: '#3b82f6',
  [MATCH_STATUS.MATCHED_BY_AMOUNT_DATE]: '#3b82f6',
  [MATCH_STATUS.MISSING_IN_PARTY]: '#ef4444',
  [MATCH_STATUS.MISSING_IN_OURS]: '#ef4444',
  [MATCH_STATUS.DUPLICATE_EXPORT_ERROR]: '#f97316',
  [MATCH_STATUS.DUPLICATE_CONFLICT]: '#ef4444',
  'TDS Deduction': '#8b5cf6',
  'TDS Amount Mismatch': '#f97316',
  'TDS + FX Difference': '#7c3aed',
  'FX Difference (Exchange Gain/Loss)': '#0891b2',
  'Manually Matched': '#6366f1',
}

