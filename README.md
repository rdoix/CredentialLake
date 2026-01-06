# CredentialLake - Credential Leak Monitoring System

A comprehensive security tool designed to help organizations proactively monitor, detect, and manage credential leaks across the internet. Protect your organization by identifying exposed credentials before they can be exploited by malicious actors.

**Key Capabilities:**
- 🔍 **Automated Monitoring**: Continuously scan for leaked credentials across multiple sources
- 📊 **Real-time Analytics**: Visualize and analyze credential exposure patterns
- 🔔 **Instant Alerts**: Get notified immediately when new leaks are discovered
- 🗂️ **Centralized Management**: Store and manage all discovered credentials in one place
- 🔐 **Security-First**: Built with security best practices and data protection in mind
- 🛡️ **Vulnerability Intelligence**: Sync CVEs from NVD, browse searchable database, monitor vulnerabilities

## ⚠️ Legal Disclaimer

**IMPORTANT**: This tool is intended for **legitimate security research and authorized penetration testing only**.

- ✅ Only use on systems you own or have explicit written permission to test
- ✅ For identifying and remediating security vulnerabilities in your own infrastructure
- ❌ Unauthorized access, data theft, or any illegal purposes are strictly prohibited

**By using this software, you agree to use it only for lawful purposes and take full responsibility for your actions. The developers are not responsible for any misuse.**

---

## 🚀 Quick Start

Get up and running in **5 minutes**:

```bash
# Clone the repository
git clone https://github.com/rdoix/CredentialLake.git
cd CredentialLake

# Run the automated setup script
chmod +x setup.sh
./setup.sh
```

The setup script will:
- ✅ Detect your OS and install Docker if needed
- ✅ Configure environment with secure defaults
- ✅ Optimize performance based on your system
- ✅ Build and start all services
- ✅ Create your admin account
- ✅ Optionally load 120k dummy credentials for testing

**Access the application**: https://localhost:8443

📖 **New to CredentialLake?** Start with [`QUICKSTART.md`](QUICKSTART.md) for a step-by-step guide.

---

## ✨ Key Features

### 🔍 Multi-Source Credential Collection
- **IntelX Integration**: Search billions of records for exposed credentials across paste sites, breaches, and dark web
- **Single & Bulk Domain Scanning**: Target specific organizations or monitor multiple domains simultaneously
- **File Upload & Processing**: Import credentials from CSV/TXT files with automatic parsing
- **Scheduled Automation**: Set up recurring scans using cron expressions for continuous monitoring

### 📊 Real-Time Analytics Dashboard
- **Executive Summary Cards**: At-a-glance metrics with total credentials, affected domains, and trends
- **Interactive Visualizations**: Top affected domains, password cloud, TLD distribution, timeline analytics
- **Domain Detail Panel**: Comprehensive statistics with drill-down capabilities and export options

### 💾 Advanced Credential Management
- **Intelligent Search & Filtering**: Multi-field search with date range, password strength, admin detection, and tag-based organization
- **Interactive Data Tables**: Sortable, responsive tables with customizable pagination and password visibility toggle
- **Bulk Actions**: Export to CSV, verify status, send notifications, and bulk delete operations

### 🔔 Intelligent Notification System
- **Multi-Channel Alerts**: Telegram, Slack, Microsoft Teams integration
- **Customizable Triggers**: New discoveries, scan completion, high-value targets, password thresholds
- **Rich Formatting**: Detailed context with credential counts, severity indicators, and direct dashboard links

### 🔐 Enterprise Security & Access Control
- **Multi-User RBAC**: Three-tier role system (Administrator, Collector, User)
- **Advanced Password Policy**: 12+ characters, complexity requirements, configurable expiration (30/90/180 days)
- **JWT Authentication**: Industry-standard tokens with 24-hour expiration and automatic refresh
- **Secure API Key Management**: Environment-based storage, never exposed in logs or responses

### 🛡️ CVE Vulnerability Intelligence
- **NVD Integration**: Sync CVEs from National Vulnerability Database API v2.0
- **Comprehensive Search**: Keyword search, year filter, multi-severity selection, CVSS scoring
- **Dashboard Integration**: Severity distribution, recent vulnerabilities, 90-day totals
- **Automatic Updates**: Daily sync at 02:00 WIB or manual trigger

### 🚀 High-Performance Architecture
- **Distributed Processing**: Background workers powered by Redis Queue (RQ) for async operations
- **Elasticsearch Integration**: Lightning-fast full-text search across millions of credentials
- **PostgreSQL Database**: ACID-compliant storage with automatic connection pooling
- **Docker Containerization**: Isolated services with health checks and automatic restarts

### 🎨 Modern User Interface
- **Light & Dark Theme**: Toggle between themes with per-user preference saving
- **Responsive Design**: Fully functional on desktop, tablet, and mobile devices
- **Interactive Charts**: Built with Recharts for smooth animations and drill-down capabilities
- **Real-Time Updates**: Server-Sent Events (SSE) for live job progress without polling

---

## 💻 System Requirements

**Minimum:**
- 4GB RAM
- 10GB disk space
- Docker 20.10+ with Docker Compose V2
- Linux, macOS, or Windows with WSL2

**Supported OS:**
- Ubuntu 20.04+, Debian 11+, Fedora 35+, CentOS/RHEL 8+
- macOS 11+ (Big Sur or later)
- Windows 10/11 with WSL2

---

## 📦 Installation

### Automated Setup (Recommended)

```bash
chmod +x setup.sh
./setup.sh
```

### Manual Setup

```bash
# 1. Configure environment
cp .env.example .env
nano .env  # Add your IntelX API key and configure settings

# 2. Start services
docker compose up -d --build

# 3. Create admin user
docker compose exec backend python cli.py --create-user admin YourPassword --role admin

# 4. (Optional) Load dummy data
docker compose exec backend python cli.py --generate-dummy
docker compose exec backend python cli.py --import-dummy dummy_credentials.json
```

See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for production deployment.

---

## 🔐 First Time Access

1. Open https://localhost:8443 in your browser
2. Accept the SSL certificate warning (self-signed for local dev)
3. Login with your admin credentials
4. Configure your IntelX API key in Settings → API Keys

---

## 📖 Documentation

- **[`QUICKSTART.md`](QUICKSTART.md)** - 5-minute getting started guide for first-time users
- **[`USER_GUIDE.md`](USER_GUIDE.md)** - Complete user manual with features and workflows
- **[`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)** - Production deployment and configuration
- **[`DUMMY_DATA_SETUP.md`](DUMMY_DATA_SETUP.md)** - Testing with 120k dummy credentials
- **[`SYSTEM_SETTINGS_GUIDE.md`](SYSTEM_SETTINGS_GUIDE.md)** - System settings explained

---

## 🛠️ Essential Commands

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
docker compose down -v && docker compose up -d --build
```

**User Management:**
```bash
# Create user
docker compose exec backend python cli.py --create-user username password --role user

# Reset password
docker compose exec backend python cli.py --reset-password username newpassword

# List users
docker compose exec backend python cli.py --list-users
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│      HTTPS Proxy (8443) - Nginx         │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│      Frontend (Next.js) - Port 3000     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│    Gateway (NestJS) - Port 3001         │
└─────┬────────────────────────────┬──────┘
      │                            │
┌─────▼─────────┐      ┌──────────▼───────┐
│ Backend       │      │ Elasticsearch    │
│ (FastAPI)     │      │ (Search)         │
└─────┬─────────┘      └──────────────────┘
      │
┌─────▼─────────┐
│ Worker (RQ)   │
│ Background    │
└─────┬─────────┘
      │
┌─────▼─────────┬──────────────────┐
│ PostgreSQL    │     Redis        │
│ (Database)    │  (Job Queue)     │
└───────────────┴──────────────────┘
```

**Tech Stack:**
- Frontend: Next.js 14, TypeScript, Tailwind CSS 4
- Backend: FastAPI (Python 3.11), NestJS (Node 20)
- Database: PostgreSQL 15, Redis 7, Elasticsearch 8.15

---

## 🔧 Troubleshooting

### Services won't start?
```bash
docker compose logs
docker compose restart
```

### Can't login?
```bash
docker compose exec backend python cli.py --reset-password admin NewPassword
```

### Port conflict?
Edit [`docker-compose.yml`](docker-compose.yml:186) and change port `8443` to another port.

### Out of memory?
Increase Docker memory allocation to 6GB+ in Docker Desktop settings.

**More help:** Check [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) troubleshooting section.

---

## ⚡ Performance Tuning

**Elasticsearch Heap** (based on your RAM):
- 16GB+ RAM: `ES_JAVA_OPTS=-Xms2g -Xmx2g`
- 8GB RAM: `ES_JAVA_OPTS=-Xms1g -Xmx1g`
- <8GB RAM: `ES_JAVA_OPTS=-Xms512m -Xmx512m`

Edit in [`docker-compose.yml`](docker-compose.yml:48) and restart: `docker compose up -d --build elasticsearch`

**Worker Scaling:**
```bash
# Edit .env
RQ_WORKERS=10  # Increase for more parallel processing

# Restart
docker compose up -d --build worker
```

---

## 🛡️ CVE Integration

Built-in vulnerability intelligence from NVD API v2.0:

- **Sync**: Manual (Dashboard button) or automatic (daily at 02:00 WIB)
- **Features**: Severity filtering, keyword search, year filter, CVSS scoring
- **Setup**: Add NVD API key in Settings → API Keys for faster sync (50 req/30s vs 5 req/30s)

---

## 🤝 Support

**Getting Help:**
1. Check logs: `docker compose logs -f`
2. Review documentation in this repository
3. Verify `.env` configuration
4. Check service health: `docker compose ps`

**Common Issues:**
- IntelX API errors → Verify API key in Settings
- Slow performance → Increase Docker memory
- Database errors → Check PostgreSQL logs
- Worker issues → Verify Redis connection

---

## 📄 License

This application uses the IntelX API. Ensure you have proper licensing and API access.

---

## 🎯 Quick Reference

**Access Points:**
- **Application (HTTPS)**: https://localhost:8443 ← **Use this**
- Application (HTTP): http://localhost:3000 (dev only)

**Note**: Backend (8000) and Gateway (3001) are internal only - not exposed for security.

**Default Credentials:**
Created during setup with your chosen username and password.

---

**Ready to start?** Run `./setup.sh` and you'll be up in minutes! 🚀

For detailed guides, see the documentation links above.
