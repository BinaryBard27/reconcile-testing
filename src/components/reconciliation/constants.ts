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
  TDS_ONLY: 'Possible TDS Deduction',
  TDS_AND_FX: 'Possible TDS + FX Difference',
  FX_ONLY: 'Possible FX Difference (Exchange Gain/Loss)',
  MANUALLY_MATCHED: 'Manually Matched',
  CURRENCY_RATE_NEEDED: 'Currency Rate Needed — Enter Exchange Rate',
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
  'Possible TDS Deduction': '#8b5cf6',
  'Possible TDS + FX Difference': '#7c3aed',
  'Possible FX Difference (Exchange Gain/Loss)': '#0891b2',
  'Manually Matched': '#6366f1',
  'Currency Rate Needed — Enter Exchange Rate': '#dc2626',
}

