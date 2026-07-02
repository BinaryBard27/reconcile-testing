const fs = require('fs');
const XLSX = require('xlsx');
const data = fs.readFileSync('./test-data/ext/New folder/SIDDHARTHA LOGISTICS FTWZ PRIVATE/ASCENDAS LEDGER-Updated Ledger.xlsx');
const workbook = XLSX.read(data, {type: 'buffer'});
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, {defval: '', raw: true});
console.log('Total rows:', rows.length);
console.log('Debits > 0:', rows.filter(r => parseFloat(r[' Debit (USD) ']) > 0).length);
console.log('Credits > 0:', rows.filter(r => parseFloat(r[' Credit (USD) ']) > 0).length);
