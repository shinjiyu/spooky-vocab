# Backend Setup Guide

## Prerequisites

- Node.js v16+ installed
- npm or yarn package manager

## Installation Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Download ECDICT Dictionary (Optional but Recommended)

The dictionary provides translations for 800,000+ English words.

**Option A: Download from GitHub (Recommended)**

```bash
# Create data directory if not exists
mkdir -p data

# Download ECDICT SQLite database (latest version)
wget https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip

# Extract
unzip ecdict-sqlite-28.zip

# Rename and move to data directory
mv stardict.db data/ecdict.db

# Clean up
rm ecdict-sqlite-28.zip
```

**Option B: Manual Download**

1. Visit: https://github.com/skywind3000/ECDICT/releases
2. Download `ecdict-sqlite-28.zip` (or latest version)
3. Extract the `stardict.db` file
4. Rename it to `ecdict.db`
5. Place it in `backend/data/` directory

**Note:** Without the dictionary, the API will still work but won't provide translations. It will return "(暂无翻译)" for unknown words.

### 3. Initialize Database

The user database will be auto-created on first run.

```bash
npm start
```

You should see:
```
✅ Database initialized successfully
✅ ECDICT dictionary loaded (or warning if not found)
```

### 4. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"status":"ok","service":"spookyvocab-backend","version":"1.0.0"}
```

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

Uses nodemon to automatically restart when files change.

### Production Mode

```bash
npm start
```

Runs the server without auto-reload.

## Testing the API

### 1. Check Vocabulary

```bash
curl -X POST http://localhost:3000/api/vocabulary/batch-check \
  -H "Authorization: Bearer testuser" \
  -H "Content-Type: application/json" \
  -d '{"words": ["implement", "comprehensive", "ubiquitous", "the"]}'
```

Expected response:
```json
{
  "implement": {
    "needTranslation": true,
    "translation": "实施；执行",
    "phonetic": "/ˈɪmplɪment/",
    "familiarity_score": 45
  },
  "the": {
    "needTranslation": false,
    "familiarity_score": 100
  }
}
```

### 2. Mark Word as Known

```bash
curl -X POST http://localhost:3000/api/feedback/known \
  -H "Authorization: Bearer testuser" \
  -H "Content-Type: application/json" \
  -d '{"word": "implement"}'
```

### 3. Get Review Words

```bash
curl http://localhost:3000/api/review/words?limit=5 \
  -H "Authorization: Bearer testuser"
```

### 4. Get User Profile

```bash
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer testuser"
```

### 5. Update User Settings

```bash
curl -X PUT http://localhost:3000/api/user/settings \
  -H "Authorization: Bearer testuser" \
  -H "Content-Type: application/json" \
  -d '{"cefr_level": "B2"}'
```

## Database Files

After first run, you should have:

```
backend/data/
├── ecdict.db        # Dictionary (manual download)
└── user_data.db     # User data (auto-created)
```

## Troubleshooting

### Port Already in Use

If port 3000 is already taken:

```bash
PORT=3001 npm start
```

### Dictionary Not Loading

Check if `data/ecdict.db` exists and is readable:

```bash
ls -lh data/ecdict.db
```

If file doesn't exist, download it following step 2 above.

### Database Errors

Reset the database:

```bash
rm data/user_data.db
npm start
```

The database will be recreated with fresh tables.

## Next Steps

1. ✅ Backend is running
2. Update Chrome extension to use real API instead of mock data
3. Test end-to-end functionality
4. Deploy backend to a server (optional)

## API Documentation

See `backend/README.md` for complete API documentation.

## File Structure

```
backend/
├── src/
│   ├── server.js              # Express server
│   ├── routes/                # API routes
│   ├── services/              # Business logic
│   ├── middleware/            # Auth middleware
│   └── utils/                 # Database utilities
├── data/                      # SQLite databases
├── package.json
├── README.md
└── SETUP.md                   # This file
```

