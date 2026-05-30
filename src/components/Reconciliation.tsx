import { useState } from 'react'
import DataConversionFlow from './reconciliation/DataConversionFlow'
import AutoRecoFlow from './reconciliation/AutoRecoFlow'
import ManualRecoFlow from './reconciliation/ManualRecoFlow'

export default function Reconciliation() {
  const [mode, setMode] = useState<'HUB' | 'CONVERT' | 'RECO_OPTIONS' | 'AUTO_RECO' | 'MANUAL_RECO'>('HUB')

  if (mode === 'CONVERT') {
    return <DataConversionFlow onBack={() => setMode('HUB')} />
  }

  if (mode === 'RECO_OPTIONS') {
    return (
      <div>
        <header className="app-header" style={{ marginBottom: 24 }}>
          <h1>Reconciliation Mode</h1>
          <p>Choose how you want to reconcile your data.</p>
        </header>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => setMode('AUTO_RECO')}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚡</div>
            <h3>Auto Reco</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
              Upload both files and let the system automatically detect formats, map columns, and reconcile everything for you.
            </p>
          </div>
          
          <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => setMode('MANUAL_RECO')}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🛠️</div>
            <h3>Manual Reco</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
              Upload files one by one, manually configure mapping, check data quality, and have full control over the process.
            </p>
          </div>
        </div>

        <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={() => setMode('HUB')}>
          Back to Hub
        </button>
      </div>
    )
  }

  if (mode === 'AUTO_RECO') {
    return <AutoRecoFlow onBack={() => setMode('RECO_OPTIONS')} />
  }

  if (mode === 'MANUAL_RECO') {
    return <ManualRecoFlow onBack={() => setMode('RECO_OPTIONS')} />
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
          <h3>Data Conversion</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Convert Tally, SAP, Zoho, or generic data into our standard Base Format.
          </p>
        </div>
        
        <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => setMode('RECO_OPTIONS')}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚖️</div>
          <h3>Reconciliation</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Match your books against customer or vendor statements to identify mismatches and missing entries.
          </p>
        </div>
      </div>
    </div>
  )
}
