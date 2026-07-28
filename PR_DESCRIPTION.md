# Performance Optimization: Memoize Payroll Panel Rows

## Summary
Reduced unnecessary re-renders in `DailyPayrollPanel` by implementing React.memo and useCallback hooks for event handlers and row components.

## Changes
- **File**: `src/components/DailyPayrollPanel.jsx`
- **Lines**: 77 insertions, 41 deletions

## What's Fixed
1. **Memoized PayrollRow component** — extracted into a memo-wrapped component with custom comparison logic to prevent re-renders when row data hasn't changed.
2. **Stabilized event handlers** — wrapped `handleEmployeeChange`, `handleDateChange`, and `handleMarkAll` in `useCallback` to ensure consistent function references across renders.
3. **Removed inline handlers** — replaced inline `onClick={() => ...}` with stable callback references in `<Select>` and `<Input>` elements.

## Performance Impact
- Reduces table row re-renders when parent state changes but row data remains stable.
- Prevents unnecessary DOM updates during employee/date selection changes.
- Improves responsiveness when marking multiple payouts as paid.

## Testing
- ✅ All tests pass (193 tests)
- ✅ ESLint validation passed
- ✅ No breaking changes to functionality

## Next Steps
- Consider applying similar pattern to other table components (`OperationsPage`, `WaitlistPanel`).
- Monitor with React Profiler to quantify performance gains in production.
- Add Sentry/performance metrics for tracking improvements over time.

## Branch
- **Branch**: `perf/memoize-payroll-rows`
- **Base**: `main`
