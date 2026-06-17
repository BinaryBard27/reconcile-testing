import React from 'react';
import './Home.css';

interface HomeProps {
  onNavigate: (id: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div className="home-dashboard">
      <div className="home-header">
        <h1 className="home-title">LedgerMatch Hub</h1>
        <p className="home-subtitle">Powerful tools to convert, reconcile, and manage your financial data with accuracy.</p>
      </div>

      <div className="home-action-cards">
        <div className="home-action-card" onClick={() => onNavigate('convert')}>
          <div className="action-card-left">
            <div className="home-card-icon-large blue-icon-bg">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="currentColor" stroke="none" fillOpacity="0.2"/>
                <path d="M14 2V8H20" stroke="currentColor"/>
                <path d="M8 13H16M8 17H16M8 9H10" stroke="currentColor"/>
              </svg>
            </div>
            <div className="action-card-text">
              <h3>Convert File Format</h3>
              <p>Convert your financial data files to a standardized format with ease.</p>
              <span className="badge badge-blue">Supports 50+ formats</span>
            </div>
          </div>
          <div className="action-card-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>

        <div className="home-action-card" onClick={() => onNavigate('reconcile')}>
          <div className="action-card-left">
            <div className="home-card-icon-large orange-icon-bg">
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 7v5M6 12v5M18 12v5M6 12h12" />
                  <rect x="10" y="3" width="4" height="4" rx="1" fill="currentColor" fillOpacity="0.2"/>
                  <rect x="4" y="17" width="4" height="4" rx="1" fill="currentColor" fillOpacity="0.2"/>
                  <rect x="16" y="17" width="4" height="4" rx="1" fill="currentColor" fillOpacity="0.2"/>
                </svg>
            </div>
            <div className="action-card-text">
              <h3>Guided Reconciliation</h3>
              <p>Match your books against customer or vendor statements to identify mismatches and missing entries.</p>
              <span className="badge badge-orange">Smart matching</span>
            </div>
          </div>
          <div className="action-card-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>
      </div>

      <div className="home-features-section">
        <h3 className="features-title">Why choose LedgerMatch?</h3>
        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon purple-icon-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
            </div>
            <div className="feature-text">
              <h4>Secure & Private</h4>
              <p>Your data is encrypted and never shared with third parties.</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon blue-icon-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </div>
            <div className="feature-text">
              <h4>Fast & Accurate</h4>
              <p>Advanced algorithms ensure quick and accurate results.</p>
            </div>
          </div>

          <div className="feature-item">
            <div className="feature-icon indigo-icon-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </div>
            <div className="feature-text">
              <h4>Insights & Reports</h4>
              <p>Get clear insights and reports to make better financial decisions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
