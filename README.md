# OHEMAA Web App

A React + Firebase web application with public pages, agent login, and protected admin tools for dashboards, transactions, ticket upload, payouts, and pricing.

## Tech Stack

- React (Create React App)
- React Router
- Firebase (Auth + Firestore)
- Tailwind CSS
- Redux Toolkit
- Recharts, Framer Motion, Axios, XLSX

## Project Structure

```text
.
|-- public/
|   `-- index.html
|-- src/
|   |-- App.js
|   |-- firebase.js
|   |-- index.js
|   |-- assets/
|   |   `-- networks/
|   |-- components/
|   |   |-- LogoutButton.jsx
|   |   `-- PrivateRoute.jsx
|   |-- pages/
|   |   |-- AdminDashboard.jsx
|   |   |-- AdminPaymentSettings.jsx
|   |   |-- AdminPriceList.jsx
|   |   |-- AdminUploadTickets.jsx
|   |   |-- AgentLogin.jsx
|   |   |-- DailyPayoutControl.jsx
|   |   |-- Kyetech.jsx
|   |   |-- NotFound.jsx
|   |   |-- Transactions.jsx
|   |   |-- UserManagement.jsx
|   |   `-- waec.jsx
|   `-- styles/
|       `-- tailwind.css
|-- package.json
`-- tailwind.config.js
```

## Routes

Public:
- /
- /waec
- /agent/login

Admin (protected):
- /admin/dashboard
- /admin/payment-settings
- /admin/daily-payout
- /admin/users
- /admin/transactions
- /admin/upload
- /admin/price-list

Fallback:
- * (Not Found)

## Prerequisites

- Node.js 18+ (recommended)
- npm 9+

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

3. Open your browser:

```text
http://localhost:3000
```

## Available Scripts

- npm start: Run app in development mode.
- npm test: Launch test runner.
- npm run build: Build production bundle.
- npm run eject: Eject CRA config (irreversible).

## Build for Production

```bash
npm run build
```

Output is generated in the build/ folder.

## Firebase Configuration Note

The current app initializes Firebase directly in src/firebase.js.

For better security and environment management, move Firebase values to environment variables (for example, .env files) and avoid hardcoding configuration in source files.

## Deployment

This project is a standard CRA build and can be deployed to:

- Firebase Hosting
- Netlify
- Vercel
- Any static hosting provider

Deploy the contents of the production build output.
