# System Settings Guide

This guide explains each system setting, whether it requires a restart, and how it affects the application.

## ⚙️ Settings Overview

### 1. Max Concurrent Scans
**Value:** 1-10 (default: 5)  
**Restart Required:** ❌ No  
**Effect:** Immediate

Controls how many scan jobs can run simultaneously in the job queue.

**How it works:**
- Applied immediately when starting new scans
- Does not affect currently running scans
- Higher values = more parallel scans but more resource usage

**When to change:**
- Increase: If you have powerful hardware and want faster processing
- Decrease: If system is overloaded or running out of memory

---

### 2. Worker Processes (RQ)
**Value:** 1-50 (default: 5)  
**Restart Required:** ⚠️ **YES - Worker container must be restarted**  
**Effect:** After restart

Controls the number of RQ worker processes in the worker container. This is job-level parallelism.

**How it works:**
- Stored in database but requires worker container restart to take effect
- Each worker process can handle one job at a time
- More workers = more jobs processed in parallel

**To apply changes:**
```bash
# After changing this setting, restart the worker:
docker compose restart worker
```

**When to change:**
- Increase: If you have many jobs queued and want faster processing
- Decrease: If worker container is using too much memory

**Note:** This setting is currently stored in the database but the worker container reads from the `RQ_WORKERS` environment variable. For this to work properly, the worker needs to read from the database on startup.

---

### 3. Parallel Domain Workers
**Value:** 1-100 (default: 20)  
**Restart Required:** ❌ No  
**Effect:** Immediate (for new jobs)

Controls thread pool size for multi-domain scan jobs. This is per-job parallelism.

**How it works:**
- Applied immediately to new multi-domain scan jobs
- Does not affect currently running jobs
- Higher values = faster multi-domain scans but more API requests

**When to change:**
- Increase: If you want faster multi-domain scans and have high API limits
- Decrease: If hitting IntelX API rate limits or getting errors

**Warning:** Setting this too high may cause:
- IntelX API rate limit errors
- Network congestion
- Memory issues

---

### 4. Domain Scan Delay
**Value:** 0-10 seconds (default: 0.1)  
**Restart Required:** ❌ No  
**Effect:** Immediate (for new jobs)

Small delay between domain requests to prevent API overload.

**How it works:**
- Applied immediately to new scan jobs
- Adds delay between each domain request
- Higher values = slower scans but more API-friendly

**When to change:**
- Increase: If getting rate limit errors from IntelX API
- Decrease: If you want faster scans and have high API limits

---

### 5. Scan Timeout
**Value:** 60-3600 seconds (default: 300)  
**Restart Required:** ❌ No  
**Effect:** Immediate (for new jobs)

Maximum time allowed for a single scan operation before it's considered failed.

**How it works:**
- Applied immediately to new scan jobs
- If a scan takes longer than this, it will be terminated
- Prevents jobs from hanging indefinitely

**When to change:**
- Increase: If scanning large domains that legitimately take longer
- Decrease: If you want faster failure detection

---

### 6. Retry Attempts
**Value:** 0-5 (default: 3)  
**Restart Required:** ❌ No  
**Effect:** Immediate (for new jobs)

Number of times to retry failed operations.

**How it works:**
- Applied immediately to new scan jobs
- If a scan fails, it will be retried this many times
- Helps handle temporary network issues

**When to change:**
- Increase: If experiencing intermittent network issues
- Decrease: If you want faster failure reporting

---

### 7. Data Retention
**Value:** 30-365 days (default: 90)  
**Restart Required:** ❌ No  
**Effect:** Applies to next cleanup job

How long to keep credential data before automatic deletion.

**How it works:**
- Credentials older than this will be deleted by cleanup job
- Cleanup job must be run manually or scheduled
- Does not delete data immediately when changed

**To run cleanup:**
```bash
docker compose exec backend python cli.py --cleanup --days 90
```

**When to change:**
- Increase: If you need longer historical data
- Decrease: If running out of disk space

---

### 8. Enable Audit Logging
**Value:** On/Off (default: Off)  
**Restart Required:** ❌ No  
**Effect:** Immediate

Track all user actions and system events.

**How it works:**
- When enabled, logs all user actions to database
- Useful for compliance and security monitoring
- May slightly impact performance

**Status:** ⚠️ **Not fully implemented**  
This feature is in the UI but the backend logging is not complete.

---

### 9. Enable Two-Factor Authentication
**Value:** On/Off (default: Off)  
**Restart Required:** ❌ No  
**Effect:** Immediate (for new logins)

Require 2FA for accessing the platform.

**How it works:**
- When enabled, users must set up 2FA on next login
- Uses TOTP (Time-based One-Time Password)
- Compatible with Google Authenticator, Authy, etc.

**Status:** ⚠️ **Not fully implemented**  
This feature is in the UI but the backend 2FA system is not complete.

---

## 🔄 Quick Reference: Restart Requirements

| Setting | Restart Required | Takes Effect |
|---------|-----------------|--------------|
| Max Concurrent Scans | ❌ No | Immediately |
| Worker Processes (RQ) | ⚠️ **YES** | After worker restart |
| Parallel Domain Workers | ❌ No | Next job |
| Domain Scan Delay | ❌ No | Next job |
| Scan Timeout | ❌ No | Next job |
| Retry Attempts | ❌ No | Next job |
| Data Retention | ❌ No | Next cleanup |
| Audit Logging | ❌ No | Immediately |
| Two-Factor Auth | ❌ No | Next login |

---

## 🔧 Implementation Status

### ✅ Fully Implemented
- Max Concurrent Scans
- Parallel Domain Workers
- Domain Scan Delay
- Scan Timeout
- Retry Attempts
- Data Retention (manual cleanup)

### ⚠️ Partially Implemented
- **Worker Processes (RQ)**: Stored in DB but worker reads from env var
  - **Fix needed**: Worker should read from database on startup
  - **Current workaround**: Set `RQ_WORKERS` in `.env` and restart worker

### ❌ Not Implemented
- **Audit Logging**: UI exists but backend logging incomplete
- **Two-Factor Authentication**: UI exists but backend 2FA incomplete

---

## 📝 Recommendations

### For Production Use:
```
Max Concurrent Scans: 5-10
Worker Processes: 5-10
Parallel Domain Workers: 10-20
Domain Scan Delay: 0.1-0.5
Scan Timeout: 300
Retry Attempts: 3
Data Retention: 90 days
Audit Logging: Enable (when implemented)
Two-Factor Auth: Enable (when implemented)
```

### For Testing/Development:
```
Max Concurrent Scans: 2-3
Worker Processes: 2-3
Parallel Domain Workers: 5-10
Domain Scan Delay: 0.1
Scan Timeout: 300
Retry Attempts: 1
Data Retention: 30 days
Audit Logging: Disable
Two-Factor Auth: Disable
```

### For High-Performance Setup:
```
Max Concurrent Scans: 10
Worker Processes: 20-50
Parallel Domain Workers: 50-100
Domain Scan Delay: 0.05
Scan Timeout: 600
Retry Attempts: 5
Data Retention: 180 days
```

**Note:** High-performance settings require:
- Powerful hardware (16GB+ RAM)
- High IntelX API limits
- Good network bandwidth

---

## 🐛 Known Issues

1. **Worker Processes (RQ)** setting requires manual restart
   - **Workaround**: Run `docker compose restart worker` after changing
   - **Future fix**: Make worker read from database on startup

2. **Audit Logging** not fully functional
   - **Status**: UI ready, backend needs implementation
   - **Impact**: Setting has no effect currently

3. **Two-Factor Authentication** not implemented
   - **Status**: UI ready, backend needs implementation
   - **Impact**: Setting has no effect currently

---

## 💡 Tips

1. **Start conservative**: Use default values first, then adjust based on performance
2. **Monitor resources**: Watch CPU, memory, and network usage when changing settings
3. **Test changes**: Make one change at a time and observe the impact
4. **Check logs**: Use `docker compose logs -f worker` to see worker behavior
5. **API limits**: Be mindful of IntelX API rate limits when increasing parallelism

---

## 🆘 Troubleshooting

### Worker not picking up RQ_WORKERS change
```bash
# Restart the worker container
docker compose restart worker

# Check worker logs
docker compose logs -f worker
```

### Too many API errors
```bash
# Reduce parallelism:
# - Decrease Parallel Domain Workers
# - Increase Domain Scan Delay
# - Decrease Worker Processes
```

### Out of memory
```bash
# Reduce resource usage:
# - Decrease Max Concurrent Scans
# - Decrease Worker Processes
# - Decrease Parallel Domain Workers
```

### Jobs not starting
```bash
# Check worker status
docker compose ps worker

# Check Redis connection
docker compose exec redis redis-cli ping

# Restart worker
docker compose restart worker
```

---

For more information, see:
- [README.md](README.md) - General documentation
- [TROUBLESHOOTING_AUTH.md](TROUBLESHOOTING_AUTH.md) - Authentication issues
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Production deployment