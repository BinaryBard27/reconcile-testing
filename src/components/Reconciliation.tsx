import { useState } from 'react'
import DataConversionFlow from './reconciliation/DataConversionFlow'
import ManualRecoFlow from './reconciliation/ManualRecoFlow'

export default function Reconciliation() {
  const [mode, setMode] = useState<'HUB' | 'CONVERT' | 'MANUAL_RECO'>('HUB')

  if (mode === 'CONVERT') {
    return <DataConversionFlow onBack={() => setMode('HUB')} />
  }

  if (mode === 'MANUAL_RECO') {
    return <ManualRecoFlow onBack={() => setMode('HUB')} />
  }

  return (
    <div>
      <header className="app-header" style={{ marginBottom: 24 }}>
        <h1>LedgerMatch Hub</h1>
        <p>Convert ledger data or run advanced reconciliations.</p>
      </header>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => setMode('CONVERT')}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔄</div>
          <h3>Convert File Format</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Convert SAP, Tally or Zoho exports to standard format
          </p>
        </div>
        
        <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => setMode('MANUAL_RECO')}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚖️</div>
          <h3>Guided Reconciliation</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Match your books against customer or vendor statements to identify mismatches and missing entries.
          </p>
        </div>
      </div>
    </div>
  )
}
