# ⚡ Quick Start Guide

Get CredentialLake running in **5 minutes** with this quick reference guide.

## ⚠️ Legal Notice

**This tool is for authorized security research only.** Only use on systems you own or have explicit permission to test. Unauthorized use is illegal and unethical.

## 🚀 One-Command Setup

```bash
chmod +x setup.sh && ./setup.sh
```

That's it! The script will handle everything automatically.

---

## 📋 What You Need

- **Docker** (will be installed automatically if missing)
- **4GB RAM** minimum
- **10GB disk space**
- **IntelX API key** (optional, can add later)

---

## 🎯 Step-by-Step

### 1. Clone & Setup

```bash
# Clone the repository
git clone https://github.com/rdoix/CredentialLake.git
cd CredentialLake

# Run automated setup
chmod +x setup.sh
./setup.sh
```

### 2. What the Script Does

The enhanced setup script will:
- ✅ **Detect your OS** (Linux, macOS, Windows/WSL2)
- ✅ **Install Docker** automatically if needed
- ✅ **Configure environment** with secure JWT secrets
- ✅ **Analyze system resources** (RAM, CPU cores)
- ✅ **Optimize performance** with recommended settings
- ✅ **Build & start services** with progress tracking
- ✅ **Health check** all containers
- ✅ **Display access URLs** and helpful commands

### 3. Interactive Prompts

The script will ask you:
- ✅ Apply recommended Elasticsearch heap settings? (based on your RAM)
- ✅ Apply recommended worker process count? (based on your CPU)
- ✅ Rebuild existing deployment? (if containers already running)

### 3. Access the Application

Open your browser:
- **HTTPS**: https://localhost:8443 ← **Use this**
- HTTP: http://localhost:3000 (dev only)

**Note**: Click "Advanced" → "Proceed" on SSL warning (normal for local dev)

### 4. Login

Use the admin credentials you created during setup

---

## 🎮 Quick Commands

### Service Management
```bash
# View status
docker compose ps

# View logs
docker compose logs -f

# Stop services
docker compose down

# Restart services
docker compose restart

# Complete reset
docker compose down -v
docker compose up -d --build
```

### User Management
```bash
# Create new user
docker compose exec backend python cli.py --create-user username password --role user

# Create admin
docker compose exec backend python cli.py --create-user admin password --role admin

# Reset password
docker compose exec backend python cli.py --reset-password username newpassword
```

---

## 🔍 First Scan

1. **Go to Collector** page
2. **Enter a domain** (e.g., `example.com`)
3. **Click "Start Scan"**
4. **Monitor progress** in "Running Jobs"
5. **View results** in "Credentials" page

---

## 🛠️ Troubleshooting

### Services won't start?
```bash
docker compose logs
docker compose restart
```

### Can't login?
```bash
# Reset admin password
docker compose exec backend python cli.py --reset-password admin NewPassword
```

### Port conflict?
Edit [`docker-compose.yml`](docker-compose.yml:186) and change port `8443` to another port.

### Need help?
Check the full [README.md](README.md) for detailed documentation.

---

## 📊 What's Included

After setup, you'll have:
- ✅ Web interface (HTTPS on port 8443)
- ✅ Backend API (port 8000)
- ✅ PostgreSQL database
- ✅ Redis job queue
- ✅ Elasticsearch search
- ✅ Background workers
- ✅ Up to 120k dummy credentials (if selected)

---

## 🎯 Next Steps

1. **Configure IntelX API** (Settings → API Keys)
2. **Run your first scan** (Collector → Single Scan)
3. **Setup notifications** (Settings → Notifications)
4. **Schedule automated scans** (Collector → Job Scheduler)
5. **Explore credentials** (Credentials → Search & Filter)

---

## 📚 More Information

- **Full Documentation**: [README.md](README.md)
- **User Guide**: [USER_GUIDE.md](USER_GUIDE.md)
- **Deployment Guide**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Dummy Data**: [DUMMY_DATA_SETUP.md](DUMMY_DATA_SETUP.md)

---

## 🆘 Quick Help

**Access Points:**
- **Application (HTTPS)**: https://localhost:8443 ← **Use this**
- Application (HTTP): http://localhost:3000 (dev only)

**Note**: Backend (8000) and Gateway (3001) are internal only - not exposed for security.

**Exposed Port:**
- 8443 - HTTPS Web Interface (only public port)

**Internal Ports** (Docker network only):
- 3000 - Frontend container
- 3001 - Gateway container
- 8000 - Backend container
- 5432 - PostgreSQL
- 6379 - Redis
- 9200 - Elasticsearch

**Essential Files:**
- `.env` - Configuration
- `docker-compose.yml` - Services
- `setup.sh` - Setup script

---

**Questions?** Check [README.md](README.md) for detailed documentation! 🚀
