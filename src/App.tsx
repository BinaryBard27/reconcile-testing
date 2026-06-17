import { useState, useEffect, useRef } from 'react'
import Home from './components/Home'
import DataConversionFlow from './components/reconciliation/DataConversionFlow'
import ManualRecoFlow from './components/reconciliation/ManualRecoFlow'
import NumberToWords from './components/NumberToWords'
import GSTCalculator from './components/GSTCalculator'
import DateCalculator from './components/DateCalculator'
import PDFConverter from './components/PDFConverter'
import './App.css'
import './Header.css'

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('micro-theme') || 'light'
  })
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('micro-theme', theme)
  }, [theme])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  const handleToolSelect = (tab: string) => {
    setActiveTab(tab)
    setIsDropdownOpen(false)
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="navbar-brand-icon blue-icon" style={{ borderRadius: '6px' }}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
          </div>
          <span className="sidebar-brand-text">MicroLedger</span>
        </div>

        <nav className="sidebar-nav">
          <button className={`sidebar-link ${activeTab === 'home' ? 'active' : ''}`} onClick={() => handleToolSelect('home')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Home
          </button>
          <button className={`sidebar-link ${activeTab === 'convert' ? 'active' : ''}`} onClick={() => handleToolSelect('convert')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Convert
          </button>
          <button className={`sidebar-link ${activeTab === 'reconcile' ? 'active' : ''}`} onClick={() => handleToolSelect('reconcile')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="10" y="3" width="4" height="4" rx="1"></rect><rect x="4" y="17" width="4" height="4" rx="1"></rect><rect x="16" y="17" width="4" height="4" rx="1"></rect><path d="M12 7v5"></path><path d="M6 12v5"></path><path d="M18 12v5"></path><path d="M6 12h12"></path></svg>
            Reconciliation
          </button>
          <button className={`sidebar-link ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleToolSelect('history')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            History
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="help-box">
            <h4>Need help?</h4>
            <p>Check our documentation or contact support.</p>
            <button className="btn btn-primary btn-full" style={{ marginBottom: '8px', background: 'var(--accent-light)', color: 'var(--accent)' }}>Documentation</button>
            <button className="btn btn-secondary btn-full" style={{ color: 'var(--accent)', border: 'none', background: 'transparent' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              Contact Support
            </button>
          </div>
          <div className="copyright">
            © 2024 MicroLedger. All rights reserved.
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="main-container">
        <header className="top-navbar" style={{ background: 'transparent', borderBottom: 'none' }}>
          <div className="navbar-brand">
            {/* Empty for flex spacing */}
          </div>
          <div className="navbar-right">
            <button className="icon-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </button>
            <button className="icon-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </button>
            <button className="icon-btn theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme" style={{ margin: '0 8px', width: '36px', height: '36px' }}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="dropdown-container" ref={dropdownRef}>
              <button 
                className="btn btn-secondary dropdown-trigger" 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                Free Tools {isDropdownOpen ? '▲' : '▼'}
              </button>
              
              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <button className="dropdown-item" onClick={() => handleToolSelect('gst')}>
                    <span className="nav-icon">🧮</span> GST Calculator
                  </button>
                  <button className="dropdown-item" onClick={() => handleToolSelect('datecalc')}>
                    <span className="nav-icon">📅</span> Date Calculator
                  </button>
                  <button className="dropdown-item" onClick={() => handleToolSelect('num2words')}>
                    <span className="nav-icon">📝</span> Number to Words
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          {activeTab === 'home' && <Home onNavigate={handleToolSelect} />}
          {activeTab === 'convert' && <DataConversionFlow onBack={() => handleToolSelect('home')} />}
          {activeTab === 'reconcile' && <ManualRecoFlow onBack={() => handleToolSelect('home')} />}
          {activeTab === 'pdfconverter' && <PDFConverter />}
          {activeTab === 'num2words' && <NumberToWords />}
          {activeTab === 'gst' && <GSTCalculator />}
          {activeTab === 'datecalc' && <DateCalculator />}
          {activeTab === 'history' && <div className="card" style={{ padding: 40, textAlign: 'center' }}><h3>History</h3><p>Your previous imports and reconciliations will appear here.</p></div>}
        </main>
      </div>
    </div>
  )
}

export default App
