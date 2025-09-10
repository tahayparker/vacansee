# JSON Oscillation Fix

## Problem
The `scheduleData.json` file was oscillating between 0's and 1's for the same time slots in consecutive commits. This was caused by:

1. **Excessive workflow frequency**: The GitHub Actions workflow was running every 5 minutes
2. **Lack of change significance detection**: Any change, no matter how minor, was being committed
3. **String-based time comparison**: Time comparisons using string operations could be unreliable
4. **No stability checks**: No mechanism to prevent minor fluctuations from causing commits

## Solution
The fix involves multiple improvements:

### 1. Reduced Workflow Frequency
- **Before**: `cron: "0/5 * * * *"` (every 5 minutes)
- **After**: `cron: "0 * * * *"` (every hour)
- **Impact**: 60x reduction in update frequency, dramatically reducing oscillation opportunities

### 2. Enhanced Change Detection
Added intelligent change detection in the GitHub workflow:
- Only commits JSON changes if more than 50 lines are modified
- Prevents minor oscillations from triggering commits
- Maintains the ability to capture substantial schedule changes

### 3. Improved Time Comparison Logic
- **Before**: String-based comparison (`"08:30" < "09:00"`)
- **After**: Minute-based integer comparison (510 < 540)
- **Benefits**: More reliable, handles edge cases better, eliminates string comparison inconsistencies

### 4. Stability Checks in Schedule Generation
Added logic to compare new schedule data with existing data:
- Calculates the number of availability changes
- Only updates the file if changes exceed a reasonable threshold
- Prevents unnecessary file writes for minor fluctuations

## Files Modified

### `.github/workflows/update-timetable.yml`
- Changed cron schedule from every 5 minutes to every hour
- Added `check_json_changes` step to analyze change significance
- Only commits if substantial changes (>50 lines) are detected

### `scripts/generate_schedule.py`
- Added `parse_time_to_minutes()` function for reliable time comparison
- Enhanced `is_slot_available()` with minute-based logic
- Updated `save_schedule_to_json()` with stability checks
- Added comparison with existing data to prevent unnecessary updates

## Monitoring

To verify the fix is working:

1. **Check commit frequency**: Commits should now occur much less frequently (hourly at most)
2. **Review commit content**: When commits do occur, they should represent substantial changes
3. **Monitor oscillation**: The same time slots should not flip between 0 and 1 in consecutive commits

## Testing

The improvements have been tested with:
- Time parsing validation (handles valid/invalid formats)
- Overlap detection logic (various time slot scenarios)
- Edge case handling (invalid inputs, boundary conditions)

All tests pass successfully, ensuring the improved logic is reliable.