# MediFind Full-Stack Application

MediFind is a production-style medicine availability and reservation application. The original responsive interface is preserved in `frontend/`; live data, authentication, geospatial pharmacy search, inventory, and reservations are supplied by the Express/MongoDB API in `backend/`.

## Project structure

```text
MediFind/
├── frontend/              Static HTML/CSS/JavaScript client
│   ├── assets/
│   ├── app.js
│   ├── config.js
│   ├── index.html
│   ├── styles.css
│   └── vercel.json
└── backend/
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── scripts/
    ├── utils/
    ├── .env.example
    ├── package.json
    ├── render.yaml
    └── server.js
```

## Local setup

Requirements: Node.js 20+ and a MongoDB Atlas database.

1. In Atlas, create a database user, allow your current IP, and copy the driver connection string.
2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` and a long random `JWT_SECRET`.
3. Install, seed, and start the API:

```powershell
cd backend
npm install
npm run seed
npm run dev
```

4. In another terminal, serve the frontend:

```powershell
cd frontend
npx serve . -l 3000
```

Open `http://localhost:3000`. Seed credentials:

- Customer: `amanda@email.com` / `password`
- Pharmacy owner: `pharmacy@medifind.lk` / `password`
- Admin: `admin@medifind.lk` / `password`

## Environment variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret used to sign access tokens |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `FRONTEND_URL` | Comma-separated allowed frontend origins |
| `LOW_STOCK_THRESHOLD` | Quantity at or below which stock is low |
| `PORT` | API port, default `5000` |

## Deployment

### Backend on Render

Create a Blueprint using `backend/render.yaml`, or create a Node web service with root directory `backend`, build command `npm ci`, and start command `npm start`. Add `MONGODB_URI`, `JWT_SECRET`, and the deployed Vercel origin as `FRONTEND_URL`. Seed once from a trusted local machine against the production Atlas URI if demo records are required.

### Frontend on Vercel

Import the repository, set the root directory to `frontend`, and deploy as a static project. Change `frontend/config.js` so `MEDIFIND_API_URL` points to the Render service, for example `https://medifind-api.onrender.com/api`.

Geolocation requires HTTPS in production. Vercel supplies HTTPS automatically. The map uses the existing Google Maps embed interface, database coordinates, browser GPS, and Google Maps directions links.

## Security notes

Passwords are hashed with bcrypt, protected endpoints require JWT bearer tokens, owner/admin actions use role authorization, login routes are rate-limited, request bodies are size-limited, Helmet security headers are enabled, CORS is origin-restricted, and API errors omit stack traces in production. For a higher-security production environment, move authentication from local storage to short-lived access tokens plus rotated HttpOnly refresh cookies.

See [backend/API.md](backend/API.md) for endpoint documentation.

## CSV imports

Admin-protected import endpoints accept medicines, pharmacies, and inventory CSV files. Editable templates are in `backend/data/csv/`. Every import validates all rows, supports a no-write dry run, upserts by public ID, rejects unknown inventory references, and calculates stock status automatically. Import medicines first, pharmacies second, and inventory last. See [backend/API.md](backend/API.md#csv-database-imports) for commands.

Pharmacy owners also have a CSV uploader directly in their dashboard after registering a pharmacy. The pharmacy-specific template combines medicine catalog fields with quantity and price, and every successful upload automatically refreshes the store inventory shown on that dashboard.
