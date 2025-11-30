# Spooky Vocab Backend

Node.js + Express backend for Spooky Vocab Chrome extension.

## Features

- RESTful API for vocabulary queries
- ECDICT offline dictionary integration (800k words)
- Adaptive learning algorithm
- User feedback tracking
- SQLite database for user data

## Tech Stack

- **Node.js** + **Express** - Server framework
- **SQLite** - Database (user data + dictionary)
- **better-sqlite3** - Fast SQLite driver
- **JWT** - Authentication (test phase: plaintext user_id)

## Installation

```bash
cd backend
npm install
```

## Database Setup

The application uses two SQLite databases:

1. **user_data.db** - User vocabulary records
2. **ecdict.db** - Dictionary data (needs to be downloaded separately)

### Download ECDICT Dictionary

```bash
# Download ECDICT SQLite database
wget https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip
unzip ecdict-sqlite-28.zip
mv stardict.db data/ecdict.db
```

Or visit: https://github.com/skywind3000/ECDICT/releases

## Running the Server

### Development mode (with auto-reload)

```bash
npm run dev
```

### Production mode

```bash
npm start
```

Server will run on: http://localhost:3000

## API Endpoints

### Vocabulary Check

```
POST /api/vocabulary/batch-check
Authorization: Bearer {user_id}

Request:
{
  "words": ["implement", "comprehensive", "ubiquitous"]
}

Response:
{
  "implement": {
    "needTranslation": true,
    "translation": "实施；执行",
    "phonetic": "/ˈɪmplɪment/",
    "familiarity_score": 45
  },
  "comprehensive": {
    "needTranslation": false,
    "familiarity_score": 72
  }
}
```

### Mark Word as Known

```
POST /api/feedback/known
Authorization: Bearer {user_id}

Request:
{
  "word": "implement"
}

Response:
{
  "success": true,
  "new_score": 60
}
```

### Mark Word as Unknown

```
POST /api/feedback/unknown
Authorization: Bearer {user_id}

Request:
{
  "word": "ephemeral",
  "context": "The ephemeral nature of technology..."
}

Response:
{
  "success": true,
  "new_score": 35
}
```

### Get Review Words

```
GET /api/review/words?limit=20
Authorization: Bearer {user_id}

Response:
{
  "words": [
    {
      "word": "implement",
      "translation": "实施",
      "phonetic": "/ˈɪmplɪment/",
      "familiarity_score": 45,
      "encounter_count": 5,
      "last_encountered": "2025-11-30T10:30:00Z"
    }
  ],
  "total": 156
}
```

### Update User Settings

```
PUT /api/user/settings
Authorization: Bearer {user_id}

Request:
{
  "cefr_level": "B2"
}

Response:
{
  "success": true
}
```

## Authentication (Test Phase)

Currently using plaintext user_id for testing:

```
Authorization: Bearer user123
```

The middleware will extract "user123" as the user_id.

Future: Implement proper JWT with encryption.

## Database Schema

### user_settings

```sql
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  cefr_level TEXT DEFAULT 'B1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### word_records

```sql
CREATE TABLE word_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  familiarity_score INTEGER DEFAULT 0,
  encounter_count INTEGER DEFAULT 0,
  known_feedback_count INTEGER DEFAULT 0,
  unknown_feedback_count INTEGER DEFAULT 0,
  last_encountered DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, word)
);
```

### word_contexts

```sql
CREATE TABLE word_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  sentence TEXT,
  url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Adaptive Learning Algorithm

Familiarity score (0-100):

**Initial Score Calculation:**
- Word frequency rank (0-40 points)
- CEFR level (0-30 points)
- User CEFR level (0-20 points)

**Dynamic Adjustments:**
- User clicks "known": +15 points
- User requests translation: -10 points
- Each encounter: +2 points
- Time decay: -5 points per 30 days

**Display Rule:**
- Score >= 65: Don't show translation
- Score < 65: Show translation

## Development Notes

### Testing with cURL

```bash
# Check vocabulary
curl -X POST http://localhost:3000/api/vocabulary/batch-check \
  -H "Authorization: Bearer testuser" \
  -H "Content-Type: application/json" \
  -d '{"words": ["implement", "comprehensive"]}'

# Mark as known
curl -X POST http://localhost:3000/api/feedback/known \
  -H "Authorization: Bearer testuser" \
  -H "Content-Type: application/json" \
  -d '{"word": "implement"}'
```

## Project Structure

```
backend/
├── src/
│   ├── server.js              # Express server entry
│   ├── routes/
│   │   ├── vocabulary.js      # Vocabulary query routes
│   │   ├── feedback.js        # User feedback routes
│   │   └── review.js          # Review routes
│   ├── models/
│   │   ├── WordRecord.js      # Word record model
│   │   └── UserSettings.js    # User settings model
│   ├── services/
│   │   ├── dictionary.js      # ECDICT dictionary service
│   │   ├── word-frequency.js  # Word frequency data
│   │   └── adaptive-algorithm.js  # Learning algorithm
│   ├── middleware/
│   │   └── auth.js            # JWT middleware
│   └── utils/
│       ├── database.js        # Database connection
│       └── init-db.js         # Database initialization
├── data/
│   ├── ecdict.db              # Dictionary (download separately)
│   ├── user_data.db           # User data (auto-created)
│   └── word_frequency.json    # Word frequency data
├── package.json
└── README.md
```

## License

MIT

