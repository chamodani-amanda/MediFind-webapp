# MediFind REST API

## Notifications

- `GET /api/notifications` — list the signed-in user's notifications and unread count.
- `PUT /api/notifications/read-all` — mark all notifications as read.
- `PUT /api/notifications/:id/read` — mark one notification as read.

Reservation creation/status changes and low-stock events create persistent notifications.

## Pharmacy inventory additions

- `POST /api/pharmacies/:id/import-inventory?dryRun=true` — validate and preview an inventory CSV without changing stock.
- `GET /api/pharmacies/:id/import-history` — list the authenticated owner's recent imports.
- `DELETE /api/pharmacies/:id/medicines/:medicineId` — remove a medicine from the authenticated owner's inventory.

Base URL: `http://localhost:5000/api`. Protected requests use `Authorization: Bearer <token>`. Responses use JSON and return `{ "success": false, "message": "..." }` on errors.

## Authentication

- `POST /auth/register` — `{ name, email, password, phone?, role: "customer" | "pharmacyOwner", preferredLanguage? }`
- `POST /auth/login` — `{ email, password, role? }`
- `POST /auth/logout` — protected; client discards its token

## Users

- `GET /users/profile` — current profile
- `PUT /users/profile` — update `name`, `phone`, or `preferredLanguage`

## Medicines

- `GET /medicines?category=&manufacturer=&page=&limit=` — paginated catalog
- `GET /medicines/search?q=&category=&manufacturer=` — name/generic/manufacturer search
- `GET /medicines/:id` — medicine and pharmacy availability
- `POST /medicines` — admin; create medicine

## Pharmacies and inventory

- `GET /pharmacies?city=&medicine=` — pharmacies with optional medicine availability
- `GET /pharmacies/nearby?lat=9.6658&lng=80.0216&radius=5&medicine=Paracetamol` — distance-sorted geospatial results; radius is kilometres
- `GET /pharmacies/mine` — pharmacy owner/admin; owned pharmacy and inventory
- `GET /pharmacies/:id` — pharmacy and complete inventory
- `POST /pharmacies` — pharmacy owner/admin; requires pharmacy name, address, city, coordinates, contact, and hours
- `PUT /pharmacies/:id` — owner/admin; update pharmacy
- `PUT /pharmacies/:id/stock` — owner/admin; `{ medicineId, quantity }`
- `POST /pharmacies/:id/import-inventory` — owner/admin CSV upload scoped to the specified pharmacy; supports `?dryRun=true`
- `PUT /pharmacies/:id/medicines/:medicineId` — owner/admin; edit medicine catalog fields plus this pharmacy's quantity, price, currency, and notes

Nearby results contain numeric `distance` in kilometres, `latitude`, `longitude`, and an optional `availability` record for the requested medicine.

### Pharmacy inventory CSV columns

| Column | Required | Purpose |
|---|---:|---|
| `medicineId` | Yes | Stable unique medicine code; repeated imports update the same medicine |
| `name` | Yes | Display/brand name |
| `genericName` | Yes | Generic/active ingredient name |
| `category` | Yes | Medicine category, such as Pain Relief or Antibiotic |
| `dosage` | No | Strength, such as 500 mg |
| `form` | No | Tablet, capsule, syrup, cream, etc. |
| `manufacturer` | No | Manufacturer or supplier |
| `description` | No | Short medicine description |
| `requiresPrescription` | No | `true` or `false`; defaults to `false` |
| `quantity` | Yes | Current stock quantity; determines in/low/out status |
| `unitPrice` | No | This pharmacy's price per unit/package |
| `currency` | No | Three-letter currency code; defaults to `LKR` |
| `notes` | No | Pharmacy-specific collection or stock note |

The upload is limited to 5 MB. The authenticated owner can only update a pharmacy belonging to their account. The UI template is available from the pharmacy dashboard after registration.

## Reservations

- `POST /reservations` — customer; `{ pharmacyId, medicineId, quantity, collectionTime }`
- `GET /reservations/user?status=` — customer's reservations
- `GET /reservations/pharmacy?status=` — reservations for the owner's pharmacies
- `PUT /reservations/:id/status` — `{ status }`; owners confirm/reject/mark ready, customers may cancel
- `PUT /reservations/:id/review` — customer; `{ rating }` from 1–5 for a collected reservation
- `DELETE /reservations/:id` — customer cancellation

Creating a reservation atomically requires sufficient stock and decrements inventory. Cancellation or rejection restores the reserved quantity.

## Health check

- `GET /health` — deployment health status

## CSV database imports

CSV imports are admin-only and use `Content-Type: text/csv`. Records are upserted, so importing the same public ID updates it instead of creating a duplicate. Add `?dryRun=true` to validate without changing the database.

- `POST /import/medicines` — medicines CSV
- `POST /import/pharmacies` — pharmacies CSV
- `POST /import/inventory` — stock CSV; medicines and pharmacies must be imported first
- `GET /import/summary` — current collection counts

Example from the `backend` directory:

```powershell
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/auth/login' -ContentType 'application/json' -Body '{"email":"admin@medifind.lk","password":"password"}'
$headers = @{ Authorization = "Bearer $($login.token)" }

# Validate without writing
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/import/medicines?dryRun=true' -Headers $headers -ContentType 'text/csv' -InFile '.\data\csv\medicines.csv'

# Import in dependency order
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/import/medicines' -Headers $headers -ContentType 'text/csv' -InFile '.\data\csv\medicines.csv'
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/import/pharmacies' -Headers $headers -ContentType 'text/csv' -InFile '.\data\csv\pharmacies.csv'
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/import/inventory' -Headers $headers -ContentType 'text/csv' -InFile '.\data\csv\inventory.csv'
Invoke-RestMethod -Method Get -Uri 'http://localhost:5000/api/import/summary' -Headers $headers
```
