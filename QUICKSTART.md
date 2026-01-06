# ⚡ Quick Start Guide

Get CredentialLake running in **5 minutes** with this step-by-step guide for first-time users.

---

## ⚠️ Legal Notice

**This tool is for authorized security research only.** Only use on systems you own or have explicit permission to test. Unauthorized use is illegal and unethical.

---

## 🎯 For First-Time Deployers

### What You'll Need

- **Docker** (will be installed automatically if missing)
- **4GB RAM** minimum (6GB+ recommended)
- **10GB disk space**
- **IntelX API key** (optional, can add later in Settings)

### What You'll Get

After setup, you'll have:
- ✅ Secure web interface (HTTPS on port 8443)
- ✅ Complete credential monitoring system
- ✅ Background job processing
- ✅ Search and analytics capabilities
- ✅ Optional: 120k dummy credentials for testing

---

## 🚀 Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/rdoix/CredentialLake.git
cd CredentialLake
```

### Step 2: Run the Setup Script

```bash
chmod +x setup.sh
./setup.sh
```

### Step 3: Follow the Interactive Prompts

The script will guide you through:

1. **OS Detection** - Automatically detects Linux, macOS, or Windows/WSL2
2. **Docker Installation** - Installs Docker if not present
3. **Environment Setup** - Creates secure configuration
4. **Resource Analysis** - Checks your RAM and CPU
5. **Performance Optimization** - Recommends settings based on your system
6. **Service Deployment** - Builds and starts all containers
7. **Admin Account** - Creates your admin user
8. **Dummy Data** (Optional) - Loads 120k test credentials

**Time Required:** 5-10 minutes (first run)

---

## 🔑 First Login

### Step 1: Access the Application

Open your browser and go to:
- **HTTPS (Recommended)**: https://localhost:8443

### Step 2: Accept SSL Certificate

You'll see a security warning (normal for local development):
1. Click **"Advanced"**
2. Click **"Proceed to localhost"** or **"Accept the Risk"**

This is safe - it's a self-signed certificate for local use.

### Step 3: Login

Use the admin credentials you created during setup.

### Step 4: Configure IntelX API (Optional)

1. Go to **Settings** → **API Keys**
2. Enter your IntelX API key
3. Click **"Save Changes"**

You can skip this and add it later when you're ready to scan.

---

## 🎮 What to Do Next

### Option 1: Explore with Dummy Data

If you loaded dummy data during setup:

1. **Dashboard** - View statistics and charts with 120k credentials
2. **Credentials** - Browse and filter test data
3. **Organizations** - See domain groupings
4. **Collector** - View sample scan jobs

This is perfect for learning the interface without making real scans.

### Option 2: Run Your First Real Scan

1. **Add API Key** (Settings → API Keys)
2. **Go to Collector** page
3. **Enter a domain** (e.g., `example.com`)
4. **Click "Start Scan"**
5. **Monitor progress** in "Running Jobs" tab
6. **View results** in "Credentials" page

---

## 📊 Understanding the Interface

### Main Navigation (Sidebar)

- **Dashboard** - Overview with charts and statistics
- **Credentials** - Browse and manage discovered credentials
- **Organizations** - View credentials grouped by domain
- **CVE Database** - Browse vulnerability intelligence
- **Collector** - Run scans and manage jobs
- **Settings** - Configure API keys, users, and preferences

### Key Features to Try

1. **Search & Filter** (Credentials page)
   - Search by email, domain, or password
   - Filter by date range and password strength
   - Show only admin accounts

2. **Bulk Actions** (Credentials page)
   - Select multiple credentials
   - Export to CSV
   - Send notifications

3. **Schedule Scans** (Collector → Job Scheduler)
   - Set up recurring scans
   - Use cron expressions
   - Enable notifications

4. **Theme Toggle** (Top-right corner)
   - Switch between light and dark mode
   - Preference is saved automatically

---

## 🛠️ Essential Commands

### View Service Status
```bash
docker compose ps
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

### Stop Services
```bash
docker compose down
```

### Restart Services
```bash
docker compose restart
```

### Complete Reset (removes all data)
```bash
docker compose down -v
docker compose up -d --build
```

---

## 🔧 Common First-Time Issues

### Issue: Port 8443 Already in Use

**Solution:** Edit [`docker-compose.yml`](docker-compose.yml:186) and change the port:
```yaml
ports:
  - "8444:8443"  # Change 8443 to 8444
```

### Issue: Services Won't Start

**Solution:**
```bash
# Check what's wrong
docker compose logs

# Try restarting
docker compose restart

# If still failing, rebuild
docker compose down
docker compose up -d --build
```

### Issue: Can't Login

**Solution:** Reset your admin password:
```bash
docker compose exec backend python cli.py --reset-password admin NewPassword
```

### Issue: Out of Memory

**Solution:** Increase Docker memory allocation:
- **Docker Desktop**: Settings → Resources → Memory (set to 6GB+)
- **Linux**: Edit `/etc/docker/daemon.json`

---

## 📚 Next Steps

### Learn More

- **[`USER_GUIDE.md`](USER_GUIDE.md)** - Complete feature documentation
- **[`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)** - Production deployment guide
- **[`DUMMY_DATA_SETUP.md`](DUMMY_DATA_SETUP.md)** - Working with test data
- **[`README.md`](README.md)** - Full project documentation

### Recommended Workflow

1. **Explore with dummy data** (if loaded)
2. **Configure your IntelX API key**
3. **Run a test scan** on a small domain
4. **Set up notifications** (Telegram/Slack/Teams)
5. **Schedule automated scans** for your domains
6. **Explore CVE database** for vulnerability intelligence

### User Management

Create additional users:
```bash
# Create regular user
docker compose exec backend python cli.py --create-user john password123 --role user

# Create collector (can run scans)
docker compose exec backend python cli.py --create-user scanner password123 --role collector

# Create admin
docker compose exec backend python cli.py --create-user admin2 password123 --role admin
```

---

## 🆘 Getting Help

### Quick Checks

1. ✅ Are all services running? `docker compose ps`
2. ✅ Any errors in logs? `docker compose logs -f`
3. ✅ Is your API key configured? Check Settings → API Keys
4. ✅ Enough memory allocated? Check Docker settings

### Access Points

- **Application (HTTPS)**: https://localhost:8443 ← **Use this**
- Application (HTTP): http://localhost:3000 (dev only)

**Note**: Backend (8000) and Gateway (3001) are internal only - not exposed for security.

### Service Ports (Internal)

- 8443 - HTTPS Web Interface (only public port)
- 3000 - Frontend container (internal)
- 3001 - Gateway container (internal)
- 8000 - Backend container (internal)
- 5432 - PostgreSQL (internal)
- 6379 - Redis (internal)
- 9200 - Elasticsearch (internal)

---

## ✅ Setup Checklist

Use this checklist to ensure everything is working:

- [ ] Docker is installed and running
- [ ] All services are up (`docker compose ps` shows all healthy)
- [ ] Can access https://localhost:8443
- [ ] Can login with admin credentials
- [ ] Dashboard loads and shows data (if dummy data loaded)
- [ ] IntelX API key configured (if ready to scan)
- [ ] Ran first test scan successfully (optional)

---

## 🎉 You're Ready!

Congratulations! You now have:
- ✅ A fully functional credential monitoring system
- ✅ Secure web interface with authentication
- ✅ Background job processing
- ✅ Search and analytics capabilities
- ✅ Optional test data to explore

**Start monitoring your domains for credential leaks!** 🚀

For detailed feature documentation, see [`USER_GUIDE.md`](USER_GUIDE.md).

For production deployment, see [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).
