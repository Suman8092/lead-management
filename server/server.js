const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const connectDB = require('./config/db');
const { syncGoogleSheet } = require('./utils/googleSheets');

dotenv.config();

const app = express();

// ✅ FIXED PATH
const clientDistPath = path.join(process.cwd(), 'client', 'dist');
const hasClientBuild = fs.existsSync(path.join(clientDistPath, 'index.html'));

// Connect Database
connectDB();

// ================= MIDDLEWARE =================

// ✅ SIMPLE CORS FIX (IMPORTANT)
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= STATIC (VERY IMPORTANT ORDER) =================

// ✅ Serve static FIRST (CSS/JS fix)
if (hasClientBuild) {
  console.log("Serving frontend from:", clientDistPath);
  app.use(express.static(clientDistPath));
}

// ================= API ROUTES =================

app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/followups', require('./routes/followups'));
app.use('/api/users', require('./routes/users'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/sheets', require('./routes/sheets'));
app.use('/api/webinars', require('./routes/webinars'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/meetings', require('./routes/meetings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Lead Management API is running' });
});

// ================= CRON =================

const hasGoogleSheetConfig = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  process.env.GOOGLE_PRIVATE_KEY &&
  process.env.GOOGLE_SHEET_ID
);

if (hasGoogleSheetConfig) {
  const syncInterval = process.env.SHEET_SYNC_INTERVAL || 5;

  cron.schedule(`*/${syncInterval} * * * *`, async () => {
    console.log(`[CRON] Auto-syncing Google Sheet at ${new Date().toLocaleString()}`);
    try {
      await syncGoogleSheet();
      console.log('[CRON] Sheet sync completed');
    } catch (err) {
      console.error('[CRON] Sheet sync failed:', err.message);
    }
  });
} else {
  console.log('Google Sheets sync disabled');
}

// ================= FRONTEND FALLBACK =================

// ✅ SPA FIX (VERY IMPORTANT)
if (hasClientBuild) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return res.status(404).end();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ================= SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});