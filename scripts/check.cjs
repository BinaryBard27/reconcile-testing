const fs = require('fs');
const Papa = require('papaparse');
const XLSX = require('xlsx');

const filePath = './test-data/ext/New folder/15. SIDDHARTHA LOGISTICS FTWZ PRIVATE/ASCENDAS LEDGER-Updated Ledger.xlsx';
const data = fs.readFileSync(filePath);
const workbook = XLSX.read(data, {type: 'buffer'});
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, {defval: '', raw: true});

console.log('Row count:', rows.length);
console.log('First 5 rows:', rows.slice(0, 5));
