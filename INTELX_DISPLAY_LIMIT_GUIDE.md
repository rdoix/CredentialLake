# IntelX Display Limit Configuration Guide

## 📋 Overview

The **Display Limit** controls how many files from IntelX search results are downloaded and inspected for credentials. This guide explains how to configure and use this feature effectively.

---

## 🎯 Quick Start

### Default Behavior
- **Default**: 50 files per scan
- **Maximum**: 500 files per scan
- **Minimum**: 1 file per scan

### Changing the Limit

#### Option 1: Via UI (Recommended)
1. Go to **Collector** page
2. Select **Single Scan** or **Multiple Scan**
3. Click **Advanced Options**
4. Set **Display Limit** (1-500)
5. Start your scan

#### Option 2: Via API
```bash
curl -X POST http://localhost:8000/api/scan/intelx/single \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "example.com",
    "display_limit": 100,
    "max_results": 1000,
    "send_alert": false
  }'
```

#### Option 3: Via Environment Variables
Add to your `.env` file:
```bash
DEFAULT_DISPLAY_LIMIT=50
MAX_DISPLAY_LIMIT=500
```

---

## 🔧 Configuration Hierarchy

Settings are applied in this order (later overrides earlier):

1. **Code Defaults** → 50 files (hardcoded)
2. **Environment Variables** → `.env` file settings
3. **Database Settings** → `app_settings` table
4. **Per-Scan Override** → UI or API request

---

## 📊 Performance Guidelines

### Recommended Limits by Use Case

| Use Case | Recommended Limit | Scan Time | Data Quality |
|----------|------------------|-----------|--------------|
| Quick Check | 10-20 files | ~30 sec | Basic |
| Standard Scan | 50-100 files | ~2-5 min | Good |
| Comprehensive | 100-200 files | ~5-10 min | Very Good |
| Deep Dive | 200-500 files | ~10-30 min | Excellent |

### Performance Factors
- **Network Speed**: Affects file download time
- **File Size**: Larger files take longer to process
- **Parallel Workers**: More workers = faster multi-domain scans
- **API Rate Limits**: IntelX may throttle requests

---

## 🚀 Deployment Instructions

### Step 1: Pull Changes
```bash
git pull origin main
```

### Step 2: Stop Containers
```bash
docker-compose down
```

### Step 3: Rebuild Containers
```bash
# Full rebuild (recommended)
docker-compose build --no-cache

# Or quick rebuild
docker-compose build
```

### Step 4: Start Containers
```bash
docker-compose up -d
```

### Step 5: Apply Database Migration
```bash
docker-compose exec backend python -c "
from backend.database import engine
from sqlalchemy import text

with open('/app/backend/migrations/add_display_limit_settings.sql', 'r') as f:
    sql = f.read()
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
        print('✅ Migration applied successfully')
"
```

### Step 6: Verify Changes
```bash
# Check backend logs
docker-compose logs backend | grep -i "display"

# Check database
docker-compose exec postgres psql -U scanner -d intelx_scanner -c "
SELECT default_display_limit, max_display_limit 
FROM app_settings 
WHERE id = 1;
"
```

---

## 🎨 UI Integration

### Adding Deployment Hint Banner

Add to your main layout or collector page:

```tsx
import DeploymentHint from '@/components/DeploymentHint';

export default function CollectorPage() {
  return (
    <>
      <DeploymentHint 
        message="IntelX display limit has been updated. Rebuild Docker to apply changes."
        storageKey="intelx_limit_update_2026"
      />
      {/* Rest of your page */}
    </>
  );
}
```

---

## 🔍 Monitoring & Debugging

### Check Current Settings
```bash
# Via API
curl http://localhost:8000/api/settings \
  -H "Authorization: Bearer YOUR_TOKEN"

# Via Database
docker-compose exec postgres psql -U scanner -d intelx_scanner -c "
SELECT * FROM app_settings WHERE id = 1;
"
```

### View Scan Logs
```bash
# Worker logs (shows file inspection progress)
docker-compose logs -f worker

# Backend logs
docker-compose logs -f backend
```

### Common Issues

#### Issue: Limit not applied
**Symptoms**: Scans still use old limit (10 files)
**Solution**:
```bash
# Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

# Verify API response
curl http://localhost:8000/api/settings | jq '.default_display_limit'
```

#### Issue: Migration fails
**Symptoms**: Database error when applying migration
**Solution**:
```bash
# Check if columns exist
docker-compose exec postgres psql -U scanner -d intelx_scanner -c "
\d app_settings
"

# If columns exist, skip migration
# If not, check PostgreSQL logs
docker-compose logs postgres
```

#### Issue: Slow scans
**Symptoms**: Scans take too long with high limits
**Solution**:
- Reduce `display_limit` to 50-100
- Increase `parallel_domain_workers` in settings
- Check network connectivity to IntelX
- Monitor worker logs for bottlenecks

---

## 📈 Best Practices

### 1. Start Small
- Begin with default (50 files)
- Gradually increase if needed
- Monitor scan duration and quality

### 2. Balance Speed vs Coverage
- Higher limits = more data but slower
- Lower limits = faster but may miss data
- Find your sweet spot (usually 50-100)

### 3. Use Time Filters
- Combine with time filters (D1, D7, M1)
- Reduces total results to inspect
- Focuses on recent data

### 4. Monitor Resources
- Watch Docker container memory
- Check disk space for logs
- Monitor database size growth

### 5. Schedule Wisely
- Run large scans during off-hours
- Use lower limits for frequent scans
- Higher limits for weekly deep dives

---

## 🔐 Security Considerations

- Display limit affects data collection volume
- Higher limits = more credentials stored
- Ensure proper access controls
- Regular database backups recommended
- Monitor for sensitive data exposure

---

## 📚 Related Documentation

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [USER_GUIDE.md](USER_GUIDE.md) - User manual
- [SYSTEM_SETTINGS_GUIDE.md](SYSTEM_SETTINGS_GUIDE.md) - System configuration

---

## 🆘 Support

If you encounter issues:

1. Check logs: `docker-compose logs -f`
2. Verify settings: `curl http://localhost:8000/api/settings`
3. Review this guide
4. Check GitHub issues
5. Contact support team

---

## 📝 Changelog

### Version 2.1.0 (2026-01-13)
- ✨ Added configurable display limits
- 🔧 Increased default from 10 to 50 files
- 🚀 Increased maximum from 100 to 500 files
- 📊 Added database settings support
- 🎨 Added UI deployment hint component
- 📚 Added comprehensive documentation

---

**Last Updated**: 2026-01-13  
**Version**: 2.1.0  
**Author**: Development Team