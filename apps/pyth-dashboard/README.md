# Pyth Network 2025 KPI Dashboard

Interactive dashboard visualizing Pyth Network's 2025 annual performance metrics.

## Quick Start (Local)

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Opens at `http://localhost:5173`

## Deploy to Vercel (Recommended)

### Option A: CLI
```bash
npm install -g vercel
vercel
```

### Option B: Web UI
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import this folder
3. Click Deploy

You'll get a URL like `https://pyth-dashboard-xxx.vercel.app`

## Deploy to Netlify

```bash
# Build production version
npm run build

# Deploy
npx netlify deploy --prod --dir=dist
```

Or drag the `dist` folder to [netlify.com/drop](https://app.netlify.com/drop)

## Share Temporarily (ngrok)

```bash
# Start dev server
npm run dev

# In another terminal
npx ngrok http 5173
```

Share the generated URL (works for ~8 hours).

## Features

- **Overview** - Key metrics at a glance
- **Staking** - PYTH token staking growth (+187% YoY)
- **Price Feeds** - Asset class expansion (+419% YoY)
- **RWA/Equity** - Fastest growing segments (+388% Equity users)
- **TVS** - Total Value Secured by chain and category
- **Volume** - Protocol trading volume ($1.29T in 2025)
- **Entropy** - VRF requests growth (+900% YoY)
- **Scorecard** - Full year comparison table

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Recharts

## Data Source

KPI data extracted from internal Pyth Network tracking spreadsheets covering January - December 2025.
