# WARP Platform Frontend

## Overview
React-based customer portal for the WARP SIP Trunking & Messaging Platform.

## Stack
- React 18+
- TypeScript
- Tailwind CSS (recommended)
- Vite or Next.js
- TanStack Query (for API calls)
- Zustand (for state management)

## Structure
```
src/
├── components/     # Reusable UI components
├── pages/         # Page-level components
├── hooks/         # Custom React hooks
├── styles/        # Global styles and themes
└── utils/         # Helper functions and API client
```

## Pages to Implement
1. **Authentication**
   - Login
   - Register
   - MFA Setup
   - Password Reset

2. **Dashboard**
   - Usage Overview
   - Recent Calls
   - Quick Stats

3. **Trunk Management**
   - List Trunks
   - Configure Trunk
   - IP Whitelist
   - Codec Settings

4. **Number Management**
   - DID Inventory
   - Purchase Numbers
   - Port Requests
   - E911 Configuration

5. **Billing**
   - Current Usage
   - Invoice History
   - Payment Methods
   - Usage Reports

6. **Support**
   - CDR Search
   - Troubleshooting
   - Documentation

## API Integration
The frontend connects to the WARP API at endpoints defined in `/warp/api/openapi.yaml`.

## Development
```bash
npm install
npm run dev
```

## Deployment
Configured for Vercel deployment (see `.env.example` for VERCEL_* variables).