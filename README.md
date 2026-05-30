# MicroLedger - Reconciliation Engine

MicroLedger is a fast, 100% client-side React application for automated and manual financial reconciliation, built with Vite and TypeScript.

## 🚀 Features
- **Data Conversion**: Instantly map accounting software exports (like Tally, SAP, Zoho) into a standard Base Format.
- **Auto Reconciliation**: Fuzzy matching algorithm that automatically detects and reconciles hundreds of transactions between your books and customer books without server lag.
- **Manual Reconciliation**: Interactive step-by-step mapping for custom or complex ledger formats.
- **PDF to CSV Converter**: A secure, browser-based tool to extract raw data from PDF bank statements into Excel-ready CSV files.
- **Utility Tools**: Built-in GST Calculator, Number to Words converter, and Date Calculator.

## 🛠️ Setup Instructions

Because the application processes data entirely on the client-side (in the browser), there are no complex backend servers or databases to configure.

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (Node Package Manager)

### 1. Installation
Clone the repository and install the dependencies:
```bash
# Clone the repository
git clone https://github.com/BinaryBard27/reconcile-testing.git

# Navigate to the directory
cd reconcile-testing

# Install dependencies
npm install
```

### 2. Local Development
Run the development server to test the app locally with hot-module replacement (HMR):
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### 3. Production Build
To create an optimized, minified production build of the application:
```bash
npm run build
```
The compiled static files will be placed in the `/dist` directory. These files can be deployed directly to any static hosting provider (e.g., Vercel, Netlify, Cloudflare Pages, AWS S3).

## 🔒 Security & Privacy
Since MicroLedger relies exclusively on client-side processing, any uploaded Excel sheets, CSVs, or PDFs are processed inside your computer's RAM. Your financial data is **never** sent to a backend server.
