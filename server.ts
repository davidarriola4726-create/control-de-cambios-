import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const claimsFile = path.join(dataDir, 'claims.json');
if (!fs.existsSync(claimsFile)) {
  fs.writeFileSync(claimsFile, JSON.stringify([], null, 2), 'utf8');
}

function getClaims(): any[] {
  try {
    const raw = fs.readFileSync(claimsFile, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveClaims(claims: any[]) {
  try {
    fs.writeFileSync(claimsFile, JSON.stringify(claims, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving claims:', err);
  }
}

// API Routes
app.get('/api/records', (req, res) => {
  const claims = getClaims();
  res.json(claims);
});

app.post('/api/records', (req, res) => {
  const claims = getClaims();
  const newRecord = req.body;
  if (!newRecord.id) {
    newRecord.id = 'REC-' + String(claims.length + 1).padStart(4, '0');
  }
  claims.unshift(newRecord);
  saveClaims(claims);
  res.status(201).json(newRecord);
});

app.put('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  let claims = getClaims();
  const index = claims.findIndex((c: any) => c.id === id || c.voucherNumber === id);
  if (index !== -1) {
    claims[index] = { ...claims[index], ...updatedData, id };
    saveClaims(claims);
    res.json(claims[index]);
  } else {
    // If not found, add it
    claims.unshift({ ...updatedData, id });
    saveClaims(claims);
    res.status(201).json(updatedData);
  }
});

app.patch('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const patchData = req.body;
  let claims = getClaims();
  const index = claims.findIndex((c: any) => c.id === id || c.voucherNumber === id);
  if (index !== -1) {
    claims[index] = { ...claims[index], ...patchData };
    saveClaims(claims);
    res.json(claims[index]);
  } else {
    res.status(404).json({ error: 'Record not found' });
  }
});

app.delete('/api/records', (req, res) => {
  saveClaims([]);
  res.json({ success: true, count: 0 });
});

app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  let claims = getClaims();
  claims = claims.filter((c: any) => c.id !== id && c.voucherNumber !== id);
  saveClaims(claims);
  res.json({ success: true, id });
});

// Serve static assets and index.html
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
