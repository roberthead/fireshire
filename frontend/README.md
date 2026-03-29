# FireShire Frontend

React frontend for the fire-resilient landscaping zone visualizer.

## Prerequisites

- Node.js 22+
- npm

## Setup

```bash
npm install
```

## Development

```bash
# Start dev server (port 5173)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check
npx tsc -b

# Lint
npm run lint

# Production build
npm run build
```

## Stack

- React 19 + TypeScript
- Vite
- TanStack Router (file-based routing in `src/routes/`)
- TanStack Query
- Mapbox GL JS + react-map-gl
- Turf.js
- Vitest + Testing Library
