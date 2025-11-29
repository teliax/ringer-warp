# Frontend Applications

This directory contains all customer-facing and admin applications for the WARP platform.

## Applications

### customer-portal/
Customer self-service portal:
- Dashboard (usage, billing, alerts)
- Phone number management
- SIP trunk configuration
- Call detail records (CDR)
- Billing & invoices
- API key management

**Stack**: React, Vite, TypeScript, Tailwind CSS
**Deployment**: Vercel

### admin-portal/
Internal admin and operations portal:
- Customer management
- Vendor management (SMPP, carriers, providers)
- System monitoring
- Rate management
- Campaign management (10DLC)
- Platform configuration

**Stack**: React, Vite, TypeScript, Tailwind CSS
**Deployment**: Vercel

## Development

Both applications use:
- **Build tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: React Query for API state
- **Auth**: Firebase Auth (Google Identity Platform)

### Running Locally

```bash
cd apps/customer-portal  # or admin-portal
npm install
npm run dev
```

### Building

```bash
npm run build
npm run preview  # Preview production build
```

## API Integration

Both apps connect to:
- **API**: https://api.rns.ringer.tel (to be deployed)
- **WebSocket**: wss://api.rns.ringer.tel/ws (real-time updates)

See `/docs/FRONTEND_API_MAPPING.md` for endpoint mappings.
