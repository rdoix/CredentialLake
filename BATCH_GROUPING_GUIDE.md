# Batch Grouping Feature Guide

## Overview

The batch grouping feature allows scheduled jobs with multiple keywords to be displayed as a single grouped entry in the Running Jobs list, instead of showing each keyword as a separate job. This significantly reduces clutter when a scheduled job runs with many keywords.

## How It Works

### Backend Changes

1. **Database Schema** (`backend/migrations/add_batch_id_to_scan_jobs.sql`)
   - Added `batch_id` UUID column to `scan_jobs` table
   - Added index for efficient batch queries
   - Groups related scan jobs from the same scheduled execution

2. **Model Updates** (`backend/models/scan_job.py`)
   - Added `batch_id` field to [`ScanJob`](backend/models/scan_job.py:11) model
   - Updated [`to_dict()`](backend/models/scan_job.py:55) method to include batch_id in API responses

3. **Scheduler Service** (`backend/services/scheduler_service.py`)
   - Modified [`_run_scheduled_job()`](backend/services/scheduler_service.py:143) to generate a single `batch_id` for all jobs in one execution
   - All scan jobs created from the same scheduled job run share the same `batch_id`

4. **Jobs API** (`backend/routes/jobs.py`)
   - Added `grouped` query parameter to [`list_jobs()`](backend/routes/jobs.py:22) endpoint
   - When `grouped=true`, jobs with the same `batch_id` are combined into a single response
   - Aggregates statistics (total_raw, total_parsed, total_new, total_duplicates) across all jobs in the batch
   - Determines overall status (prioritizes: running > failed > completed)
   - Returns `batch_size` and `batch_queries` for grouped jobs

### Frontend Changes

1. **TypeScript Types** (`types/collector.ts`)
   - Added `batchId`, `batchSize`, and `batchQueries` fields to [`ScanJob`](types/collector.ts:1) interface

2. **Collector Page** (`app/collector/page.tsx`)
   - Updated API call to include `?grouped=true` parameter
   - Maps batch fields from API response to UI state

3. **RunningJobs Component** (`components/collector/RunningJobs.tsx`)
   - Displays batch size badge when `batchSize > 1`
   - Shows up to 5 keywords with "+X more" indicator for larger batches
   - Aggregated statistics are displayed for the entire batch

## Usage

### For Scheduled Jobs

When a scheduled job runs with multiple keywords:

**Before:**
```
Running Jobs (10 entries)
- Job: Daily Banking Scan - bank.com
- Job: Daily Banking Scan - finance.org
- Job: Daily Banking Scan - payment.com
... (7 more individual entries)
```

**After:**
```
Running Jobs (1 entry)
- Job: Daily Banking Scan [10 keywords]
  Keywords: bank.com, finance.org, payment.com, wallet.io, credit.net +5 more
  Total: 1,234 credentials (aggregated from all 10 scans)
```

### API Endpoints

#### Get Grouped Jobs
```bash
GET /api/jobs/?grouped=true
```

Returns jobs with batch grouping applied.

#### Get Individual Jobs
```bash
GET /api/jobs/?grouped=false
# or
GET /api/jobs/
```

Returns all jobs individually (default behavior).

## Migration

To apply the database migration:

```bash
# Using psql
psql -U your_user -d your_database -f backend/migrations/add_batch_id_to_scan_jobs.sql

# Or using the CLI tool
python backend/cli.py migrate
```

## Benefits

1. **Reduced Clutter**: 10 keywords = 1 grouped entry instead of 10 separate entries
2. **Better Overview**: See aggregated statistics at a glance
3. **Easier Management**: Control all related jobs as a single unit
4. **Improved Performance**: Fewer UI elements to render
5. **Backward Compatible**: Existing jobs without `batch_id` still display normally

## Technical Details

### Batch Status Logic

The grouped job status is determined by:
1. If any job is running/collecting/parsing/upserting → status = "running"
2. Else if any job failed → status = "failed"
3. Else if all jobs completed → status = "completed"
4. Else if any job is queued → status = "queued"
5. Else → use base job status

### Statistics Aggregation

All numeric fields are summed across the batch:
- `total_raw`: Sum of all raw credentials
- `total_parsed`: Sum of all parsed credentials
- `total_new`: Sum of all new credentials
- `total_duplicates`: Sum of all duplicates

### Timestamps

- `started_at`: Earliest start time across all jobs in batch
- `completed_at`: Latest completion time across all jobs in batch

## Future Enhancements

Potential improvements:
1. Batch-level pause/resume controls
2. Batch-level cancellation
3. Per-keyword status breakdown in details modal
4. Batch progress indicator showing X/Y keywords completed
5. Configurable grouping preferences (always/never/auto)