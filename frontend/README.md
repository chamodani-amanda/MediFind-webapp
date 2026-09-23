# MediFind Frontend

Responsive, accessible frontend for the MediFind medicine availability and pharmacy reservation system. It connects to the Express/MongoDB API configured in `config.js`.

## Run locally

Start the backend first, then serve this directory from the project root:

```powershell
cd backend
npm start
```

```powershell
cd ..
npx serve frontend
```

Open `http://localhost:3000`. Browser location works on localhost or HTTPS. Configure `MEDIFIND_GOOGLE_MAPS_API_KEY` in `config.js` and enable Maps JavaScript API and Directions API for map features.

## Main workflows

- Customer and pharmacy registration/login
- Medicine autocomplete and pharmacy search
- Availability, distance, price and prescription filters
- Live-location pharmacy map and directions
- Reservation progress and notifications
- Pharmacy inventory editing and removal
- Validated CSV preview/import and import history
- Pharmacy coordinate picker
- Responsive layouts, keyboard focus, skip navigation, text sizing and dark mode
