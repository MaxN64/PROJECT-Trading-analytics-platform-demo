MES Calc — Trade Journal, Analytics, and Risk Management

End-to-end trading app: React (CRA) on the frontend and Node.js/Express + MongoDB (Mongoose) + GridFS on the backend. Supports importing trades from VolFix CSV, storing attachments (images/audio), calculating metrics, and condition-based filters.

/ (repository)
├─ mes-calc-frontend/ — React client (CRA)
└─ mes-calc-backend/ — API on Express + MongoDB (GridFS) + Mongoose

What matters to an employer

Business value: trade journaling, visual analytics, risk control, fast import from VolFix (CSV), storage of trade artifacts (screenshots, audio notes) — all in one place.

Tech stack:
Front: React 19, CRA, React Router, Axios, Recharts, Lightweight-Charts.
Back: Node.js/Express, Mongoose, GridFS, Multer, csv-parse.

Architecture: REST API, file storage via GridFS, parameterized CORS, health probe, production build of the frontend can be served by the backend.

Data import: robust VolFix CSV parsing (auto-detect delimiter, normalization of numbers/dates, dry-run, update mode).

Models & indexes: well-designed Trade schema with indexes (by user/date/net result), Attachment with metadata and linkage to GridFS.

Practices: centralized error handling, simple (but extensible) auth, separation of concerns by layers.



![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210016.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210037.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210059.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210115.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210128.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210139.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210150.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210233.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210249.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210302.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210327.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210405.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210420.png)

![Превью проекта](https://github.com/MaxN64/PROJECT-Trading-analytics-platform-demo/blob/master/mes-calc-frontend/public/docs/210504.png)

1) Frontend — mes-calc-frontend
Stack & dependencies

package.json:

React ^19.1.1, react-dom ^19.1.1

react-scripts 5.0.1 (Create React App)

react-router-dom ^7.8.2

@reduxjs/toolkit ^2.8.2, react-redux ^9.2.0 (the project has state hooks; Redux Toolkit can be easily plugged in if needed)

axios ^1.11.0

recharts ^3.1.2, lightweight-charts ^5.0.8

@testing-library/*, web-vitals

API configuration (important)

The base URL is resolved by priority — any method works:

window.APP_CONFIG.apiBase (if set globally in index.html),

REACT_APP_API_URL (CRA) from .env,

VITE_API_URL (for future/compat),

default: http://localhost:3001.

File: src/lib/api.js.

You can also control the trades fetch limit:

REACT_APP_TRADES_LIMIT (CRA) or VITE_TRADES_LIMIT — see src/hooks/useTradesApi.js.

Key UI features

Trade list with filters: dates, hours, outcome (win/loss), conditions/tags.

Analytics cards: Equity Curve, Weekly PnL/Performance, Summary Totals, Visual Metrics, Fib Entry Planner, etc.

Position Calculator, Day Risk, contract presets.

Embedded media: image preview, audio notes.

Import from VolFix (CSV) via UI, with results display (imported/updated/skipped).

Economic calendar and chart widgets (including dual-charts embed).

Easy adaptation for Electron (in production the frontend can be served by the backend).

Structure (shortened)
src/
├─ App.js, App.module.css
├─ components/            # Cards, Charts, Analytics, Modals, Header/Footer
├─ hooks/                 # useTradesApi, useSettings, useDayRisk, ...
├─ lib/                   # api.js, metrics.js, contracts.js
├─ pages/                 # AiPlanPage, TvDualPage
└─ index.js, index.css

Run
cd mes-calc-frontend
npm install
npm start         # CRA dev server: http://localhost:3000

# build for production:
npm run build


A .env file is already in the project — by default REACT_APP_API_URL=http://localhost:3001.

2) Backend — mes-calc-backend
Stack & dependencies

package.json:

express ^4.21.2, cors ^2.8.5, cookie-parser ^1.4.7

mongoose ^8.18.0, mongodb ^6.19.0 (GridFS)

multer ^1.4.5-lts.1 (upload)

csv-parse ^5.6.0 (VolFix CSV import)

dotenv ^16.6.1

scripts: dev, cleanup-orphans

Configuration & environment variables

.env (exists at the backend root):

PORT=3001
MONGO_URI=mongodb://localhost:27017/mes_calc
CORS_ORIGIN=http://localhost:3000
# Additionally supported:
# FRONTEND_DEV_PORT=3000      # for CORS in dev (if you change the frontend port)
# FRONTEND_DIST=/abs/path     # if you want to serve the built frontend as static


CORS: in dev, allow the frontend origin; in prod, if FRONTEND_DIST is set, CORS can be opened “wider”.

Health check: GET /health returns { ok: true }.

Structure
server/
├─ src/
│  ├─ index.js                # server config, CORS, static frontend in prod
│  ├─ db.js                   # connectDB(), GridFS buckets (images/audio)
│  ├─ middleware/
│  │  ├─ auth.js              # attachUser: takes userId from X-User-Id (demo)
│  │  └─ error.js             # centralized error handler
│  ├─ models/
│  │  ├─ Trade.js             # trade schema + indexes
│  │  └─ Attachment.js        # link GridFS files to trades
│  └─ routes/
│     ├─ trades.js            # CRUD + batch-metrics
│     ├─ attachments.js       # upload/stream/delete (GridFS)
│     └─ volfix.js            # VolFix CSV import
└─ scripts/
   └─ cleanup-orphans.js      # remove orphaned files from GridFS

Data models (shortened)

Trade (server/src/models/Trade.js):
userId, time fields (createdAt, updatedAt, localHour, nyHour), trade results (isProfit, pnl, fee, netR, drawdown, …), external key bindings (openOrderId, closeOrderId, externalKey), plus a set of metric fields vj_* (equivalent from Volume Journal).
Indexes: { userId, externalKey } (unique, sparse), { userId, createdAt }, { userId, netR }.

Attachment (server/src/models/Attachment.js):
userId, tradeId, kind: image|audio|file, mimeType, size, durationMs (for audio), fileId (GridFS ID), name.

REST API (key)

Health

GET /health → { ok: true }

Trades (/api/trades, file routes/trades.js)

GET /api/trades
Parameters: dateFrom, dateTo, hourFrom, hourTo, outcome=all|win|loss, conditions, tags, matchAll=0|1, limit (≤500), skip.

POST /api/trades — create a trade.

PATCH /api/trades/:id — partial update (whitelist of fields).

DELETE /api/trades/:id — delete a trade.

POST /api/trades/batch-metrics — batch save daily metrics:

{
  "dateKey": "YYYY-MM-DD",
  "mode": "FADE|BREAKOUT",
  "items": [ { "id": "<tradeId>", "patch": { /* subset of metric fields */ } } ]
}


GET /api/trades/:id/attachments/stats — return attachment summary (count of unique images, etc.).

Attachments / GridFS (/api, file routes/attachments.js)

Upload (universal):
POST /api/trades/:tradeId/attachments (file field, multipart/form-data) — auto-detects type by mimetype.

Targeted uploads:
POST /api/trades/:tradeId/attachments/images — images only; max 4 per trade.
POST /api/trades/:tradeId/attachments/audio — a single audio note per trade (replaces previous).

Streams (download/view):
GET /api/attachments/stream/:id — serve any file by ID (auto-selects bucket).
GET /api/attachments/images/:id — serve an image.
GET /api/attachments/audio/:id — serve audio.

Delete image:
DELETE /api/trades/:tradeId/attachments/images/:fileId.

VolFix CSV Import (/api/integrations/volfix/import, file routes/volfix.js)

Method: POST (accepts multipart/form-data with file file or application/json with array rows).

Query params:
instrument=ES (default),
tickSize=0.25, tickValue=12.5,
dry=1 (dry-run, does not write to DB),
update=1 (update mode by externalKey=openOrderId).

Features:
auto-detect CSV delimiter ; / , .,
normalization of monetary/numeric fields ($, ,, -),
unifying date formats (dd.MM.yy(yy), dd/MM/yy(yy), yyyy-MM-dd, with/without seconds).
Response contains counters imported/updated/skipped and sample reasons for skips.

Authorization

Demonstration: attachUser middleware takes the ID from X-User-Id header; if absent — a constant demo ID is used.
For production, it’s intended to replace this with JWT/OIDC and full permissions/limits.

Local run (together)
npm install
# check .env (port/MongoDB URI/CORS)
npm run dev
# → API listens on http://localhost:3001

Key endpoints

GET /health

GET/POST/PATCH/DELETE /api/trades

POST /api/trades/batch-metrics

POST /api/trades/:id/attachments[/(images|audio)]

GET /api/attachments/(images|audio|stream)/:id

DELETE /api/trades/:id/attachments/images/:fileId

POST /api/integrations/volfix/import?dry=1&update=1&instrument=ES&tickSize=0.25&tickValue=12.5



