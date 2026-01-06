# IntelX Scanner - User Guide

## 🎯 Quick Start

### Access Your Scanner
Open your browser and navigate to: **http://localhost:3000**

---

---

## ⚙️ Settings & API Configuration

### Step 1: Add Your IntelX API Key

1. Go to **Settings** page (sidebar)
2. Click **"API Keys"** tab
3. Enter your IntelX API key in the green-bordered field
4. Click **"Save Changes"**
5. ✅ Key is now saved permanently!

**Note**: Your API key persists even when you navigate away or refresh the page.

---

## 🔍 Running Scans

### Single Domain Scan

1. Go to **Collector** page
3. Click **"Active Scanner"** tab
4. Enter your domain/keyword (e.g., `example.co.id`)
5. Set **Max Results** (1-10000)
6. Select **Time Filter**:
   - **D1** = 1 Day
   - **D7** = 7 Days
   - **D30** = 30 Days
   - **W1** = 1 Week
   - **W2** = 2 Weeks
   - **W4** = 4 Weeks
   - **M1** = 1 Month
   - **M3** = 3 Months
   - **M6** = 6 Months
   - **Y1** = 1 Year
7. (Optional) Click **"Advanced Options"**:
   - Set Display Limit
   - Enable "Send alert" for notifications
8. Click **"Start Single Scan"**
9. You'll receive a Job ID confirmation

---

## 📊 Monitoring Jobs

### Viewing Running Jobs

1. Go to **Collector** → **Running Jobs** tab
2. See all your active and completed scans
3. Jobs auto-refresh every 3 seconds

### Job Information Displayed

For each job you'll see:
- **Type**: Single, Bulk, File, or Scheduled
- **Target**: The domain/keyword you scanned
- **Status**: Pending, Running, Completed, or Failed
- **Progress**: Real-time progress bar (for running jobs)
- **Credentials Stats**:
  - Total credentials found
  - Successfully parsed
  - Unparsed/failed
  - Parse rate percentage
- **Timestamps**: When started and completed

### Job Status Indicators

- 🔵 **Running** - Job is currently processing
- ✅ **Completed** - Job finished successfully
- ⏰ **Pending** - Job is queued, waiting to start
- ❌ **Failed** - Job encountered an error

---

## 🗑️ Managing Jobs

### Delete Individual Job

1. Go to **Running Jobs** tab
2. Find the job you want to delete
3. Click the **trash icon** (🗑️) on the right side of the job card
4. Confirm deletion
5. Job is immediately removed

### Clear All Jobs

1. Go to **Running Jobs** tab
2. Click **"Clear All"** button (top-right, red)
3. Confirm you want to delete ALL jobs
4. All jobs are permanently removed
5. Get fresh start with clean database

**Use Case**: Perfect for starting fresh with your real account - clear all old data and only keep YOUR new scans.

---

## 💡 Best Practices

### For Clean Data Management

1. **Organize Your Scans**:
   - Use descriptive keywords
   - Choose appropriate time filters
   - Delete completed jobs you no longer need

3. **Monitor Progress**:
   - Jobs tab auto-refreshes every 3 seconds
   - Watch parse rates to gauge data quality
   - Check for failed jobs and errors

---

## 🎨 UI Features

### Color-Coded Status

- **Blue/Primary**: Running jobs, active scans
- **Green/Accent**: Completed successfully
- **Yellow/Warning**: Pending, waiting
- **Red/Danger**: Failed jobs, errors
- **Purple/Secondary**: Parse rates, analytics

### Auto-Refresh

- Running Jobs refreshes **every 3 seconds**
- No manual refresh needed
- Always see latest status

### Responsive Design

- Clean, modern interface
- Easy-to-read statistics
- Intuitive navigation
- Professional look & feel

---

## 🔧 Technical Details

### Data Persistence

**Settings**:
- Stored in browser `localStorage`
- Key: `intelx_scanner_settings`
- Persists across sessions

### API Endpoints

**Fetch Jobs**: `GET /api/jobs/`
**Get Specific Job**: `GET /api/jobs/{job_id}`
**Delete Job**: `DELETE /api/jobs/{job_id}`
**Clear All Jobs**: `DELETE /api/jobs/`
**Start Scan**: `POST /api/scan/intelx/single`

### Job Polling

- Interval: 3 seconds
- Auto-stops when leaving page
- Restarts when returning to Jobs tab

---

## 🚀 Workflow Example

### Complete Scan Workflow

```
1. Go to Settings → Add API Key ⚙️
   └─ Save IntelX API key

3. Go to Collector → Active Scanner 🔍
   └─ Enter: example.co.id
   └─ Time Filter: D7 (7 days)
   └─ Max Results: 1000
   └─ Click "Start Single Scan"

4. Go to Running Jobs Tab 📊
   └─ Watch progress in real-time
   └─ See credentials count update
   └─ Wait for completion

5. Review Results ✅
   └─ Total: 7,657 credentials
   └─ Parsed: 7,632 (99.7%)
   └─ Unparsed: 25

6. Clean Up (Optional) 🗑️
   └─ Delete job when done
   └─ Or keep for records
```

---

## ❓ Troubleshooting

### Jobs Not Appearing?

1. ✅ Check API key is saved in Settings
3. ✅ Verify backend is running: `docker-compose ps`
4. ✅ Check backend logs: `docker-compose logs backend`

### Can't Delete Jobs?

1. ✅ Ensure backend is running
2. ✅ Check browser console for errors (F12)
3. ✅ Try refreshing the page

---

## 🎉 You're All Set!

You now have:
- ✅ Persistent API key storage
- ✅ Real-time job monitoring
- ✅ Job deletion capabilities
- ✅ Clean, professional interface
- ✅ Auto-refreshing job status

**Happy Scanning!** 🚀
