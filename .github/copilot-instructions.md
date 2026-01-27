# SquadOps Dashboard - AI Coding Guidelines

## Project Overview
This is a real-time React dashboard for squad execution governance, displaying KPIs across 7 pillars (Project Management, Demand Forecasting, Work Intake, Squad Formation, Flex Management, Capacity & Utilization, Project Execution). Data is stored in Firebase Firestore with live updates.

## Architecture
- **Frontend**: React 18 + Vite, single-page app with sidebar navigation
- **Backend**: Firebase Firestore (real-time NoSQL), Firebase Auth (anonymous/custom token)
- **Styling**: Tailwind CSS + inline CSS variables for theming
- **Data Flow**: Firestore onSnapshot listeners → React state → useMemo calculations → UI updates

## Key Files & Structure
- `src/App.jsx`: Main app with auth, data fetching, view switching (Dashboard/DataEntry)
- `src/main.jsx`: React root render
- `src/index.css`: Tailwind directives + custom body background
- `package.json`: Scripts (dev/build/preview), deps (React, Firebase, Lucide icons, Chart.js)
- Firebase config hardcoded in App.jsx (replace with your project keys)

## Data Model
Firestore collections under `/artifacts/{appId}/public/data/`:
- `resources`: {org: 'Supplier'|'Customer', count: number}
- `timesheets`: {week: 'YYYY-WW', coreHours: number, flexHours: number}
- `agile_metrics`: {sprint: string, storyPoints: number, status: 'Done', type: 'Story'}
- `slas`: {sprint: string, defectDensity: number, uatEscapes: number}
- `financials`: {month: 'YYYY-MM', capacity: number, demand: number}
- `milestones`: {axiaId, axiaName, axiaOwnerCpc, axiaMilestone, axiaMilestoneDescription, axiaMilestoneObjective, axiaMilestoneDueDate, axiaMilestoneOwnerLtim, axiaMilestoneStatus, axiaMilestoneStatusDescription, axiaMilestoneStatusDate}

## Development Workflow
1. `npm run dev` - Start Vite dev server (hot reload)
2. Data entry via "Data Entry" tab forms
3. Dashboard auto-updates via Firestore real-time listeners
4. `npm run build` - Production build to `dist/`
5. `npm run preview` - Preview production build

## Coding Patterns
- **Styling**: Define CSS variables in `:root`, use inline `<style>{styles}</style>` for component styles, mix Tailwind classes with inline styles
- **Status Logic**: `getStatusClass(status)` returns 'status-green'|'status-amber'|'status-red' based on thresholds (e.g., util >95% = red)
- **Calculations**: Use `useMemo` for KPI computations from raw data (e.g., utilization = (core+flex)/capacity *100)
- **Data Fetching**: `onSnapshot(query(collection(...)))` for real-time updates, no manual refresh needed
- **Forms**: Controlled components with `useState`, submit to `addDoc(collection(...))`
- **Icons**: Import from `lucide-react` (e.g., `<BarChart2 />`)
- **Charts**: Use `react-chartjs-2` for complex charts, simple bars via CSS flexbox
- **Modals**: Use fixed positioning with backdrop for detail views (e.g., milestone details modal)

## Firebase Setup
1. Create Firebase project at console.firebase.google.com
2. Enable Firestore and Anonymous Auth
3. Replace `firebaseConfig` in App.jsx with your keys
4. Data structure: Nested collections for multi-tenant support

## Common Tasks
- **Add KPI**: Add calculation in `DashboardView` useMemo, display in pillar card with `kpi-row` class
- **New Data Type**: Add collection constant, form in `DataEntryView`, listener in App useEffect
- **View/Edit Data**: Use `handleEdit`, `handleDelete`, `handleCancelEdit` functions for CRUD operations
- **Styling**: Update CSS string in `styles` variable, use `--primary-color` etc. for consistency
- **Status Thresholds**: Modify logic in useMemo (e.g., velocity <30 = amber)

## Gotchas
- Firestore paths are deeply nested: `artifacts/{appId}/public/data/{collection}`
- CSS is inlined as string, not separate files
- Anonymous auth requires enabling in Firebase console
- Real-time updates happen automatically - no polling needed
- Sample data via "Load Sample Data" button in Data Entry