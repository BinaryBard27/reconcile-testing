import React from 'react';
import './Home.css';

interface HomeProps {
  onNavigate: (id: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div className="home-dashboard">
      <div className="home-header">
        <h1>LedgerMatch Hub</h1>
        <p>Smart tools to streamline your accounting workflow.</p>
      </div>

      <div className="home-cards-grid">
        <div className="home-card" onClick={() => onNavigate('pdfconverter')}>
          <div className="home-card-icon blue-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="currentColor"/>
              <path d="M14 2V8H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 13H16M8 17H16M8 9H10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="home-card-content">
            <h3>Convert File Format</h3>
            <p>Convert XLS, CSV or other reports to standard format</p>
          </div>
          <div className="home-card-arrow blue-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </div>

        <div className="home-card" onClick={() => onNavigate('reconcile')}>
          <div className="home-card-icon orange-icon">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="10" y="3" width="4" height="4" rx="1" />
                <rect x="4" y="17" width="4" height="4" rx="1" />
                <rect x="16" y="17" width="4" height="4" rx="1" />
                <path d="M12 7v5" />
                <path d="M6 12v5" />
                <path d="M18 12v5" />
                <path d="M6 12h12" />
              </svg>
          </div>
          <div className="home-card-content">
            <h3>Reconciliation</h3>
            <p>Match your books against compare or vendor statements to identify or reconcile any missing entries.</p>
          </div>
          <div className="home-card-arrow orange-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
