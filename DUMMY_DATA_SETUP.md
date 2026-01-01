# Dummy Data Setup Guide

This guide explains how to set up and use dummy data for the IntelX Scanner application. The dummy data system provides up to 120,000 unique credentials for testing and demonstration purposes.

## Overview

The dummy data system includes:
- **Up to 120,000 unique credentials** with realistic patterns for testing
- **Dummy scan jobs** (10 completed/running/failed jobs)
- **Dummy scheduled jobs** (5 scheduled scans)
- **Realistic data distribution**:
  - Indonesian domains (.id TLDs) - 30%
  - International domains (.com, .io, etc.) - 70%
  - Admin credentials - ~10-15%
  - Various subdomains, usernames, and password patterns

## Quick Start

### Step 1: Generate Dummy Data

Generate up to 120k unique credentials:

```bash
python backend/cli.py --generate-dummy
```

This will create:
- `dummy_credentials.json` - Up to 120k credentials (~40-80MB)
- `dummy_credentials_stats.json` - Statistics about the generated data

**Generation time:** ~2-5 minutes depending on your system

### Step 2: Import Dummy Data

Import the generated data into the database:

```bash
python backend/cli.py --import-dummy dummy_credentials.json
```

This will:
1. Create the dummy user account
2. Import all credentials in batches (up to 120k)
3. Create 10 dummy scan jobs
4. Create 5 dummy scheduled jobs
5. Link credentials to jobs

**Import time:** ~5-15 minutes depending on your system and database

### Step 3: Login and Explore

1. Start the application:
   ```bash
   docker-compose up
   ```

2. Navigate to: `http://localhost:3000`

3. Login with your admin credentials

4. Explore the dummy data:
   - **Dashboard:** View statistics and charts
   - **Credentials:** Browse up to 120k credentials with filters
   - **Organizations:** See domain groupings
   - **Collector:** View dummy scan jobs and scheduled jobs

## Detailed Usage

### Generate Custom Amount

To generate a different number of credentials, modify the generator script:

```python
# In backend/dummy_data_generator.py, line ~380
credentials = generator.generate_batch(count=50000)  # Change to desired count
```

### Import Without Jobs

To import only credentials without creating dummy jobs:

```bash
python backend/dummy_data_importer.py dummy_credentials.json --no-jobs
```

### Re-import Data

If you need to re-import:

1. Clear existing data:
   ```bash
   docker-compose down -v  # Remove volumes
   docker-compose up -d postgres  # Start fresh database
   ```

2. Import again:
   ```bash
   python backend/cli.py --import-dummy dummy_credentials.json
   ```

## Data Structure

### Credentials

Each credential includes:
- `url` - Full URL (http/https with optional path)
- `username` - Email or username format
- `password` - Realistic weak password patterns
- `domain` - Extracted domain
- `is_admin` - Boolean flag for admin credentials
- `first_seen` - Random timestamp within last year
- `last_seen` - Timestamp after first_seen
- `seen_count` - Number of times seen (1-10)

### Admin User Account

- Created during setup with your chosen credentials
- **Role:** `admin` (full access)
- **Status:** Active

### Scan Jobs

10 dummy scan jobs with:
- Various job types: `intelx_single`, `intelx_multi`, `file`
- Different statuses: `completed`, `running`, `failed`
- Realistic statistics (raw, parsed, new, duplicates)
- Timestamps spread over last 30 days

### Scheduled Jobs

5 dummy scheduled jobs with:
- Different cron schedules (daily, weekly, monthly)
- Various keywords and domains
- Notification settings (Telegram, Slack, Teams)
- 80% active, 20% inactive

## Statistics

After generation, you'll see statistics like:

```
Total Credentials: Up to 120,000
Admin Credentials: ~20,000-30,000 (10-15%)
Unique Domains: ~5,000-8,000
Unique TLDs: 20-30

Top Domains:
  - acme.com: 2,500 credentials
  - techcorp.io: 2,300 credentials
  - example.co.id: 2,100 credentials
  ...

TLD Distribution:
  - .com: 80,000 credentials
  - .id: 40,000 credentials
  - .io: 30,000 credentials
  ...
```

## Performance Considerations

### Generation Performance

- **Memory usage:** ~500MB-1GB during generation
- **Disk space:** ~50-100MB for JSON file
- **Time:** 2-5 minutes for 120k credentials

### Import Performance

- **Batch size:** 1,000 credentials per batch
- **Total batches:** 200 batches
- **Time:** 5-15 minutes depending on:
  - Database performance
  - Disk I/O speed
  - System resources

### Database Impact

After import:
- **Database size:** ~200-300MB
- **Credentials table:** Up to 120,000 rows
- **Organizations:** ~5,000-8,000 unique domains
- **Query performance:** Optimized with indexes

## Troubleshooting

### Generation Issues

**Problem:** Out of memory during generation

**Solution:** Reduce batch size or generate in smaller chunks:
```python
# Generate 50k at a time
for i in range(4):
    credentials = generator.generate_batch(count=50000)
    generator.save_to_json(credentials, f'dummy_credentials_part{i+1}.json')
```

### Import Issues

**Problem:** Import fails with database connection error

**Solution:** Ensure database is running:
```bash
docker-compose up -d postgres
# Wait 10 seconds for postgres to be ready
python backend/cli.py --import-dummy dummy_credentials.json
```

**Problem:** Duplicate key errors during import

**Solution:** The importer skips duplicates automatically. If you see many duplicates, you may have already imported the data.

**Problem:** Import is very slow

**Solution:** 
1. Check database resources
2. Increase batch size in `dummy_data_importer.py`:
   ```python
   imported_count = importer.import_credentials(credentials_data, batch_size=5000)
   ```

### Login Issues

**Problem:** Cannot login to admin account

**Solution:** Verify user was created:
```bash
docker-compose exec postgres psql -U scanner -d intelx_scanner -c "SELECT username, email, role FROM users WHERE role='admin';"
```

If not found, re-run import or create manually via UI.

## Integration with Deployment

### First-Time Deployment

For new deployments, follow this sequence:

1. **Deploy containers:**
   ```bash
   docker-compose up -d
   ```

2. **Generate dummy data:**
   ```bash
   docker-compose exec backend python cli.py --generate-dummy
   ```

3. **Import dummy data:**
   ```bash
   docker-compose exec backend python cli.py --import-dummy dummy_credentials.json
   ```

4. **Access application:**
   - URL: `https://localhost:8443`
   - Login with your admin credentials

### Automated Setup Script

Create a setup script for easy deployment:

```bash
#!/bin/bash
# setup_dummy_data.sh

echo "Starting IntelX Scanner with dummy data..."

# Start services
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 15

# Generate dummy data
echo "Generating dummy data..."
docker-compose exec -T backend python cli.py --generate-dummy

# Import dummy data
echo "Importing dummy data..."
docker-compose exec -T backend python cli.py --import-dummy dummy_credentials.json

echo "✅ Setup complete!"
echo "Login at https://localhost:8443"
echo "Use the admin credentials you created during setup"
```

Make it executable:
```bash
chmod +x setup_dummy_data.sh
./setup_dummy_data.sh
```

## Data Characteristics

### Domain Distribution

- **Indonesian domains (.id):** 30%
  - go.id, co.id, ac.id, or.id, web.id, etc.

- **International domains:** 70%
  - .com, .io, .net, .org, .dev, .app, etc.
  - Tech company names (acme, techcorp, quantum, etc.)

### Username Patterns

- Email format: `firstname.lastname@domain.com`
- Numbered usernames: `john123@domain.com`
- Admin accounts: `admin@domain.com`, `administrator@domain.com`
- Role-based: `support@domain.com`, `sales@domain.com`

### Password Patterns

Realistic weak passwords commonly found in breaches:
- Base passwords: `password`, `admin`, `123456`, `qwerty`
- With years: `password2024`, `admin2023`
- With special chars: `password!`, `admin@123`
- Simple patterns: `abc123`, `letmein`, `welcome`

### Subdomain Patterns

- Common: `www`, `mail`, `webmail`, `portal`
- Admin: `admin`, `dashboard`, `secure`
- Development: `dev`, `staging`, `test`, `demo`
- Services: `api`, `app`, `cloud`, `vpn`

## Best Practices

1. **Use for testing only:** Dummy data is for development and testing, not production

2. **Regenerate periodically:** Generate fresh data for different test scenarios

3. **Clean up after testing:** Remove dummy data before production deployment

4. **Document test scenarios:** Keep track of what dummy data represents

5. **Version control:** Don't commit generated JSON files (add to `.gitignore`)

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never use in production:** Dummy data is for testing only
2. **Weak passwords by design:** Passwords are intentionally weak for testing
3. **No real data:** All data is randomly generated and fictional
4. **Clean before production:** Always remove dummy data before going live
5. **Separate environments:** Use different databases for testing and production

## Cleanup

To remove all dummy data:

```bash
# Stop services
docker-compose down

# Remove volumes (deletes all data)
docker-compose down -v

# Restart fresh
docker-compose up -d
```

Or remove only dummy user and credentials:

```sql
-- Connect to database
docker-compose exec postgres psql -U scanner -d intelx_scanner


-- Delete all credentials (if you want to start fresh)
DELETE FROM job_credentials;
DELETE FROM credentials;
DELETE FROM scan_jobs;
DELETE FROM scheduled_jobs;
```

## Support

For issues or questions:
1. Check this documentation
2. Review error messages in console
3. Check database logs: `docker-compose logs postgres`
4. Check application logs: `docker-compose logs backend`

## Summary

The dummy data system provides a complete testing environment with:
- ✅ Up to 120k realistic credentials
- ✅ Scan jobs and scheduled jobs
- ✅ Realistic data distribution
- ✅ Easy generation and import
- ✅ Full integration with application

Perfect for:
- Development and testing
- Demonstrations and presentations
- Performance testing
- UI/UX validation
- Training and onboarding