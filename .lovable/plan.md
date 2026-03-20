
# Remove HealthDashboard Component

## Changes

### 1. `src/pages/UserDashboard.tsx`
- Remove the `import HealthDashboard` line
- Remove the `<HealthDashboard />` element from the JSX

### 2. `src/components/HealthDashboard.tsx`
- Delete the file entirely — it's no longer used anywhere

The Health Passport already displays real-time wellness and medication scores with live data from the database, making these hardcoded cards redundant.
