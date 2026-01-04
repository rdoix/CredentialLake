# CredentialLake - Credential Leak Monitoring System

A comprehensive security tool designed to help organizations proactively monitor, detect, and manage credential leaks across the internet. Protect your organization by identifying exposed credentials before they can be exploited by malicious actors.

**Key Capabilities:**
- 🔍 **Automated Monitoring**: Continuously scan for leaked credentials across multiple sources
- 📊 **Real-time Analytics**: Visualize and analyze credential exposure patterns
- 🔔 **Instant Alerts**: Get notified immediately when new leaks are discovered
- 🗂️ **Centralized Management**: Store and manage all discovered credentials in one place
- 🔐 **Security-First**: Built with security best practices and data protection in mind
- 🛡️ **Vulnerability Intelligence (CVE)**: Sync CVEs from NVD, browse a searchable database, view severity distribution, and monitor recent vulnerabilities on the dashboard

## ⚠️ Legal Disclaimer

**IMPORTANT**: This tool is intended for **legitimate security research and authorized penetration testing only**.

- ✅ **Authorized Use**: Only use this tool on systems and data you own or have explicit written permission to test
- ✅ **Security Research**: For identifying and remediating security vulnerabilities in your own infrastructure
- ✅ **Compliance**: Ensure compliance with all applicable laws and regulations in your jurisdiction
- ❌ **Prohibited**: Unauthorized access, data theft, malicious activities, or any illegal purposes

**By using this software, you agree to:**
1. Use it only for lawful and ethical purposes
2. Obtain proper authorization before scanning any systems
3. Comply with all applicable laws and regulations
4. Take full responsibility for your actions

**The developers and contributors of this project are not responsible for any misuse or damage caused by this software.**

## 🚀 Quick Start (Recommended)

Get up and running in minutes with our enhanced automated setup script:

```bash
# Clone the repository
git clone https://github.com/rdoix/CredentialLake.git
cd CredentialLake

# Run the automated setup script
chmod +x setup.sh
./setup.sh
```

The enhanced setup script features:
- ✨ **Beautiful UI** with colored output and progress indicators
- 🔍 **Smart OS detection** (Linux, macOS, Windows/WSL2)
- 🐳 **Auto-install Docker** if not present
- 🔐 **Secure configuration** with auto-generated JWT secrets
- 📊 **Resource analysis** (RAM, CPU cores)
- ⚙️ **Performance optimization** with recommended settings
- 🎯 **7-step guided process** with clear feedback
- 🛡️ **Safe deployment** with existing container detection
- ✅ **Health monitoring** until all services are ready

**That's it!** Access the application at **https://localhost:8443**

---

## 📋 Table of Contents

- [Features](#-features)
- [System Requirements](#-system-requirements)
- [Installation Methods](#-installation-methods)
  - [Automated Setup (Recommended)](#1-automated-setup-recommended)
  - [Manual Setup](#2-manual-setup)
- [First Time Access](#-first-time-access)
- [Usage Guide](#-usage-guide)
- [Management Commands](#-management-commands)
- [Architecture](#-architecture)
- [Troubleshooting](#-troubleshooting)
- [Advanced Configuration](#-advanced-configuration)

---

## ✨ Key Features

### 🔍 **Multi-Source Credential Collection**
CredentialLake provides flexible data ingestion methods to gather credential leaks from various sources:

- **IntelX Integration**: Leverage the powerful IntelX API to search across billions of records for exposed credentials. Simply enter a domain or keyword, and let CredentialLake automatically fetch and parse results from paste sites, data breaches, and dark web sources.

- **Single Domain Scan**: Target specific organizations by searching for credentials associated with a single domain. Perfect for focused security assessments and monitoring specific attack surfaces.

- **Bulk Domain Scanning**: Monitor multiple domains simultaneously with our parallel processing engine. Upload a list of domains and track progress in real-time as CredentialLake scans each one, ideal for MSPs and organizations managing multiple brands.

- **File Upload & Processing**: Import credentials from CSV or TXT files with automatic parsing and deduplication. Upload breach data from external sources, security tools, or manual investigations. The system intelligently extracts email addresses, passwords, and associated metadata.

- **Scheduled Automation**: Set up recurring scans using cron expressions to continuously monitor your domains. Configure daily, weekly, or custom schedules to ensure you're always aware of new credential exposures without manual intervention.

### 📊 **Real-Time Analytics Dashboard**
Get instant visibility into your credential exposure landscape with comprehensive visualizations:

- **Executive Summary Cards**: At-a-glance metrics showing total credentials discovered, unique domains affected, password strength distribution, and recent activity trends. Each card provides actionable insights with color-coded severity indicators.

- **Top Affected Domains**: Interactive horizontal bar chart displaying which domains have the most credential exposures. Click any domain to drill down into specific credentials and see detailed breach information.

- **Password Cloud Visualization**: Discover the most commonly used passwords across your organization with an engaging word cloud. Larger words indicate more frequent usage, helping identify weak password patterns that need addressing.

- **TLD Distribution Analysis**: Understand your exposure across different top-level domains (.com, .org, .net, etc.) with a polar area chart. Identify which domain extensions are most vulnerable and prioritize remediation efforts.

- **Timeline Analytics**: Track credential discovery over time with interactive line charts showing daily ingestion rates. Identify breach patterns, monitor remediation progress, and spot sudden spikes that may indicate new data dumps.

- **Domain Detail Panel**: Click any domain to view comprehensive statistics including total credentials, unique users, password strength breakdown, and temporal distribution. Export domain-specific data for reporting or further analysis.

### 💾 **Advanced Credential Management**
Efficiently organize, search, and act on discovered credentials with powerful management tools:

- **Intelligent Search & Filtering**: Find exactly what you need with multi-field search across emails, domains, passwords, and breach sources. Apply complex filters including:
  - Date range selection to focus on recent or historical breaches
  - Password strength filtering (weak, medium, strong)
  - Admin account detection to prioritize high-value targets
  - Tag-based organization for categorizing credentials by project, client, or severity
  - Source filtering to track which breaches or scans discovered specific credentials

- **Interactive Data Tables**: Browse credentials in a responsive, sortable table with customizable columns. Toggle password visibility with a single click, sort by any field, and adjust pagination (10/25/50/100 records per page) to match your workflow.

- **Detailed Credential View**: Click any credential to see comprehensive metadata including:
  - Full email address and associated domain
  - Password (with show/hide toggle for security)
  - Breach source and discovery date
  - Password strength analysis with visual indicators
  - Associated tags and custom notes
  - Historical context and related credentials from the same breach

- **Bulk Actions**: Select multiple credentials and perform batch operations:
  - **Export to CSV**: Generate reports for stakeholders or import into other security tools
  - **Verify Status**: Mark credentials as verified, false positive, or remediated
  - **Send Notifications**: Alert security teams via Telegram, Slack, or Microsoft Teams
  - **Bulk Delete**: Remove outdated or irrelevant credentials to maintain data hygiene

- **Real-Time Statistics Bar**: Always visible summary showing filtered results count, selected items, and quick action buttons. Stay oriented even when working with large datasets.

### 🔔 **Intelligent Notification System**
Stay informed about new credential discoveries with flexible alerting:

- **Multi-Channel Notifications**: Configure alerts via Telegram, Slack, or Microsoft Teams. Receive instant notifications when new credentials are discovered, scans complete, or critical thresholds are exceeded.

- **Customizable Triggers**: Set up notification rules based on:
  - New credential discoveries
  - Scan completion events
  - High-value target detection (admin accounts, executive emails)
  - Password strength thresholds
  - Domain-specific alerts

- **Rich Message Formatting**: Notifications include detailed context with credential counts, affected domains, severity indicators, and direct links to view results in the dashboard.

### 🔐 **Enterprise Security & Access Control**
Built with security-first principles for enterprise deployment:

- **Multi-User Support with RBAC**: Create unlimited user accounts with three-tier role-based access control:
  - **Administrator**: Full system access including user management, settings, and all operations
  - **Collector**: Can perform scans, upload files, and manage credentials
  - **User**: Read-only access to view credentials and dashboards
  
- **Advanced Password Policy**: Enforced strong password requirements including:
  - Minimum 12 characters with uppercase, lowercase, digits, and special characters
  - Password cannot contain username or email
  - Configurable password expiration (30/90/180 days or never expire)
  - Password expiry warnings and enforcement
  - Bcrypt hashing with automatic salt generation

- **JWT Authentication**: Industry-standard JSON Web Token authentication with 24-hour token expiration and secure session management. Automatic token refresh and secure credential handling.

- **Secure API Key Management**: Store sensitive API keys (IntelX, Telegram, Slack, Microsoft Teams) securely in environment variables. Keys are never exposed in logs, client-side code, or API responses.

- **Account Security Features**:
  - Account activation/deactivation controls
  - Self-service password reset (admin-assisted)
  - Protection against self-deletion and last admin removal
  - Secure session management with automatic logout

- **Audit Trail**: Comprehensive user action tracking (UI ready, backend in development)

- **Two-Factor Authentication**: TOTP-based 2FA for enhanced security (UI ready, backend in development)

### ⚙️ **Flexible Configuration & Customization**
Tailor CredentialLake to your organization's needs:

- **System Settings**: Configure concurrent scan limits, API timeouts, data retention policies, and worker process counts to optimize performance for your infrastructure.

- **User Preferences**: Each user can customize their experience with theme selection (dark/light), default page sizes, auto-refresh intervals, and notification preferences.

- **API Integration**: Secure REST API with comprehensive endpoints for programmatic access. Integrate CredentialLake into your existing security workflows, SIEM systems, or automation pipelines.

- **Data Retention Policies**: Configure automatic cleanup of old credentials based on age, source, or custom criteria. Maintain compliance with data protection regulations while keeping your database lean.

### 🚀 **High-Performance Architecture**
Designed for scale and reliability:

- **Distributed Job Processing**: Background workers powered by Redis Queue (RQ) handle scanning, parsing, and indexing asynchronously. Scale horizontally by adding more worker processes.

- **Elasticsearch Integration**: Lightning-fast full-text search across millions of credentials. Advanced query capabilities with fuzzy matching, wildcards, and complex boolean logic.

- **PostgreSQL Database**: Reliable, ACID-compliant storage for credential metadata, user accounts, and system configuration. Automatic connection pooling and query optimization.

- **Docker Containerization**: All services run in isolated containers with health checks, automatic restarts, and resource limits. Deploy anywhere Docker runs - from laptops to cloud infrastructure.

- **Reverse Proxy with TLS**: Nginx proxy provides HTTPS encryption, request routing, and static file serving. Self-signed certificates for development, easy integration with Let's Encrypt for production.

### 📈 **Monitoring & Observability**
Keep track of system health and performance:

- **Running Jobs Dashboard**: Real-time view of active scans with progress indicators, elapsed time, and status updates. Pause, resume, or cancel jobs as needed.

- **Parse Statistics**: Track parsing success rates to identify problematic data sources or formats. Monitor unparsed credentials and investigate parsing failures.

- **Service Health Checks**: All containers include health endpoints monitored by Docker Compose. Automatic service recovery if health checks fail.

- **Comprehensive Logging**: Structured logs from all services with configurable verbosity. Easy troubleshooting with `docker compose logs -f`.

### 🎨 **Modern User Interface**
Intuitive, responsive design built with cutting-edge technologies:

- **Light & Dark Theme**: Toggle between light and dark modes to match your preference. Dark theme reduces eye strain during long analysis sessions, while light theme provides clarity in bright environments. Theme preference is saved per user.

- **Responsive Design**: Fully functional on desktop, tablet, and mobile devices. Manage credentials and monitor scans from anywhere with adaptive layouts.

- **Interactive Charts**: Built with Recharts for smooth animations and responsive interactions. Hover for details, click to drill down, and export charts as images.

- **Real-Time Updates**: Server-Sent Events (SSE) provide live updates for running jobs without polling. See scan progress update in real-time with progress bars and status indicators.

- **Keyboard Shortcuts**: Power user features with keyboard navigation and shortcuts for common actions.

- **Professional Design**: Clean, modern interface with consistent styling, smooth transitions, and intuitive navigation. Built with Tailwind CSS 4 for optimal performance.

---

## 💻 System Requirements

### Minimum Requirements
- **RAM**: 4GB available
- **Disk Space**: 10GB free
- **OS**: Linux, macOS, or Windows with WSL2
- **Docker**: 20.10+ with Docker Compose V2

### Supported Operating Systems
- ✅ Ubuntu 20.04+
- ✅ Debian 11+
- ✅ Fedora 35+
- ✅ CentOS/RHEL 8+
- ✅ Arch Linux
- ✅ macOS 11+ (Big Sur or later)
- ✅ Windows 10/11 with WSL2

---

## 📦 Installation Methods

### 1. Automated Setup (Recommended)

The easiest way to get started:

```bash
# Make the script executable
chmod +x setup.sh

# Run the setup
./setup.sh
```

The script will guide you through:
1. OS detection and Docker installation
2. Environment configuration
3. Service deployment
4. Optional dummy data setup (120k credentials)
5. Admin user creation

**Time**: 5-10 minutes (first run)

---

### 2. Manual Setup

If you prefer manual control:

#### Step 1: Install Docker

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**macOS:**
```bash
brew install --cask docker
# Start Docker Desktop from Applications
```

**Windows:**
Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop)

#### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your IntelX API key
nano .env
```

Required variables in `.env`:
```env
INTELX_KEY=your_intelx_api_key_here
DB_PASSWORD=scanner
JWT_SECRET_KEY=your-secure-random-string-here
```

#### Step 3: Build and Start Services

```bash
# Build and start all services
docker compose up -d --build

# Check service status
docker compose ps
```

#### Step 4: Create Admin User

```bash
# Create your admin account
docker compose exec backend python cli.py --create-user admin YourSecurePassword --role admin
```

#### Step 5: (Optional) Setup Dummy Data

```bash
# Generate 120k dummy credentials
docker compose exec backend python cli.py --generate-dummy

# Import the data
docker compose exec backend python cli.py --import-dummy dummy_credentials.json
```

---

## 🔐 First Time Access

1. **Open your browser** and navigate to:
   - **HTTPS (Recommended)**: https://localhost:8443
   - HTTP (Development): http://localhost:3000

2. **SSL Certificate Warning**: 
   - You'll see a security warning (self-signed certificate)
   - Click "Advanced" → "Proceed to localhost"
   - This is normal for local development

3. **Login** with your admin credentials

4. **Configure IntelX API Key** (if not set during setup):
   - Go to Settings → API Keys
   - Add your IntelX API key
   - Save changes

---

## 📖 Usage Guide

### Running Your First Scan

1. **Navigate to Collector** page
2. **Choose scan type**:
   - **Single Scan**: Enter a domain (e.g., `example.com`)
   - **Bulk Scan**: Enter multiple domains (one per line)
   - **File Upload**: Upload CSV/TXT file with domains
3. **Configure options**:
   - Set time filter (optional)
   - Add tags for organization
4. **Start scan** and monitor progress in "Running Jobs"

### Viewing Results

1. **Go to Credentials** page
2. **Use filters** to narrow down results:
   - Search by email, domain, or password
   - Filter by date range
   - Filter by password strength
   - Show only admin accounts
3. **Export data** using bulk actions or export button

### Scheduling Automated Scans

1. **Go to Collector** → **Job Scheduler**
2. **Create new scheduled job**:
   - Enter domain/keyword
   - Set cron schedule (e.g., `0 2 * * *` for daily at 2 AM)
   - Enable notifications
3. **Save** and the job will run automatically

---

## 🛠️ Management Commands

### Service Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart backend

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
```

### Database Management

```bash
# Access PostgreSQL
docker exec -it credlake_postgres psql -U scanner -d intelx_scanner

# Backup database
docker exec credlake_postgres pg_dump -U scanner intelx_scanner > backup.sql

# Restore database
docker exec -i credlake_postgres psql -U scanner -d intelx_scanner < backup.sql
```

### User Management

```bash
# Create new user
docker compose exec backend python cli.py --create-user username password --role user

# Create admin user
docker compose exec backend python cli.py --create-user admin password --role admin

# List all users
docker compose exec backend python cli.py --list-users
```

### Data Management

```bash
# Generate dummy data
docker compose exec backend python cli.py --generate-dummy

# Import dummy data
docker compose exec backend python cli.py --import-dummy dummy_credentials.json

# Export credentials to CSV
docker compose exec backend python cli.py --export-csv output.csv
```

### System Maintenance

```bash
# Clean up old data
docker compose exec backend python cli.py --cleanup --days 90

# Rebuild all services
docker compose up -d --build

# Complete reset (removes all data)
docker compose down -v
docker compose up -d --build
```

---

## 🏗️ Architecture

### Services Overview

```
┌─────────────────────────────────────────────────────────┐
│                    HTTPS Proxy (8443)                    │
│                    Nginx with TLS                        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Frontend (Next.js)                      │
│                    Port 3000                             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Gateway (NestJS) - Port 3001                │
│              API Proxy + SSE Support                     │
└─────┬──────────────────────────────────────────┬────────┘
      │                                           │
┌─────▼──────────────────┐           ┌───────────▼────────┐
│  Backend (FastAPI)     │           │  Elasticsearch     │
│     Port 8000          │           │    Port 9200       │
└─────┬──────────────────┘           └────────────────────┘
      │
┌─────▼──────────────────┐
│  Worker (Python RQ)    │
│  Background Jobs       │
└─────┬──────────────────┘
      │
┌─────▼──────────────────┬───────────────────────────────┐
│  PostgreSQL (5432)     │      Redis (6379)             │
│  Main Database         │      Job Queue & Cache        │
└────────────────────────┴───────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS 4
- Recharts (Analytics)
- Lucide React (Icons)

**Backend:**
- FastAPI (Python 3.11)
- NestJS (Node 20) - Gateway
- PostgreSQL 15 - Database
- Redis 7 - Job Queue
- Elasticsearch 8.15 - Search
- RQ - Background Jobs

---

## 🔧 Troubleshooting

### Services Won't Start

**Check Docker status:**
```bash
docker compose ps
docker compose logs
```

**Common fixes:**
```bash
# Restart all services
docker compose restart

# Rebuild if code changed
docker compose up -d --build

# Complete reset
docker compose down -v
docker compose up -d --build
```

### Port Conflicts

If ports 8443, 3000, 3001, or 8000 are in use:

1. Edit [`docker-compose.yml`](docker-compose.yml:186)
2. Change the port mapping (left side only):
```yaml
ports:
  - "8444:8443"  # Change 8443 to 8444
```

### Database Connection Issues

```bash
# Check PostgreSQL health
docker compose ps postgres

# View PostgreSQL logs
docker compose logs postgres

# Restart PostgreSQL
docker compose restart postgres
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker compose logs -f worker

# Restart worker
docker compose restart worker

# Check Redis connection
docker compose exec redis redis-cli ping
```

### SSL Certificate Warnings

This is normal for local development with self-signed certificates:
- Click "Advanced" in your browser
- Select "Proceed to localhost"
- Or use HTTP: http://localhost:3000 (development only)

### Can't Login

```bash
# Reset admin password
docker compose exec backend python cli.py --reset-password admin NewPassword

# Create new admin user
docker compose exec backend python cli.py --create-user newadmin password --role admin
```

### Out of Memory

Increase Docker memory allocation:
- **Docker Desktop**: Settings → Resources → Memory (increase to 6GB+)
- **Linux**: Edit `/etc/docker/daemon.json`

---

## ⚙️ Advanced Configuration

### Environment Variables

Edit [`.env`](.env.example:1) file:

```env
# Database
DB_PASSWORD=your_secure_password

# IntelX API
INTELX_KEY=your_api_key

# Vulnerability Intelligence (NVD CVE API) - Optional
# Increases rate limit from ~5 req/30s to 50 req/30s for faster syncs
NVD_API_KEY=your_nvd_api_key

# Security
JWT_SECRET_KEY=generate_with_openssl_rand_hex_32

# Notifications (Optional)
TEAMS_WEBHOOK_URL=https://your-teams-webhook
SLACK_WEBHOOK_URL=https://your-slack-webhook
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Worker Configuration
RQ_WORKERS=5  # Number of parallel workers
RQ_QUEUES=default  # Queue names
```

### Production Deployment

For production use:

1. **Change default passwords** in `.env`
2. **Use proper SSL certificates** (Let's Encrypt)
3. **Enable Elasticsearch security**
4. **Configure firewall rules**
5. **Setup log rotation**
6. **Configure automated backups**
7. **Use reverse proxy** (Nginx/Traefik)

See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for detailed instructions.

### Custom Domain Setup

1. Update [`docker-compose.yml`](docker-compose.yml:138):
```yaml
environment:
  - CORS_ORIGIN=https://yourdomain.com
```

2. Configure your reverse proxy to point to port 8443

3. Setup SSL certificate with Let's Encrypt

### Scaling Workers

Increase parallel processing:

```bash
# Edit .env
RQ_WORKERS=10  # Increase worker count

# Restart worker service
docker compose up -d --build worker
```

---

## ⚡ Performance Tuning (Elasticsearch Heap)

Elasticsearch performance is heavily influenced by heap size. Increasing heap (within safe limits) improves indexing/search throughput and reduces GC pauses.

Recommended heap settings (based on host RAM):
- 16GB RAM or more: `ES_JAVA_OPTS=-Xms2g -Xmx2g`
- 8GB RAM: `ES_JAVA_OPTS=-Xms1g -Xmx1g`
- Less than 8GB RAM: `ES_JAVA_OPTS=-Xms512m -Xmx512m`

How to apply:
1. Edit the Elasticsearch environment in [`docker-compose.yml`](docker-compose.yml:48) and set `ES_JAVA_OPTS` to the recommended value.
2. Restart Elasticsearch (or rebuild): `docker compose up -d --build elasticsearch`
3. If using Docker Desktop, ensure enough memory is allocated in Docker Desktop → Settings → Resources.

Notes and best practices:
- Keep heap ≤ 50% of available RAM and under ~31g to preserve compressed OOPs performance characteristics.
- Swap should be avoided for Elasticsearch; memlock is already configured in [`docker-compose.yml`](docker-compose.yml:51).
- The setup script prints resource-based suggestions after environment setup. See [`setup.sh`](setup.sh:162).

## 📚 Additional Documentation

- [`QUICKSTART.md`](QUICKSTART.md) - Quick reference guide
- [`SYSTEM_SETTINGS_GUIDE.md`](SYSTEM_SETTINGS_GUIDE.md) - System settings explained
- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) - Production deployment
- [`USER_GUIDE.md`](USER_GUIDE.md) - Detailed user manual
- [`DUMMY_DATA_SETUP.md`](DUMMY_DATA_SETUP.md) - Testing with dummy data

---

## 🤝 Support

### Getting Help

1. **Check logs**: `docker compose logs -f`
2. **Review documentation** in this repository
3. **Check service health**: `docker compose ps`
4. **Verify environment**: Check `.env` configuration

### Common Issues

- **IntelX API errors**: Verify your API key in Settings
- **Slow performance**: Increase Docker memory allocation
- **Database errors**: Check PostgreSQL logs and connectivity
- **Worker issues**: Verify Redis connection and worker logs

---

## 📄 License

This application uses the IntelX API. Ensure you have proper licensing and API access.

---

## 🎯 Quick Reference

### Essential Commands

```bash
# Start everything
./setup.sh

# View status
docker compose ps

# View logs
docker compose logs -f

# Stop everything
docker compose down

# Complete reset
docker compose down -v && docker compose up -d --build
```

### Access Points

- **Application (HTTPS)**: https://localhost:8443 ← **Use this**
- **Application (HTTP)**: http://localhost:3000 (dev only)

**Note**: Backend (8000) and Gateway (3001) ports are internal only - not exposed to host for security.

### Default Credentials

**Admin User**: Created during setup with your chosen username and password

---

**Ready to start?** Run `./setup.sh` and you'll be up in minutes! 🚀

---

## 🛡️ CVE Integration

CredentialLake includes built-in vulnerability intelligence sourced from the National Vulnerability Database (NVD) API v2.0.

- Data source: NVD CVE API v2.0 (deduplicated by CVE ID)
- Sync options:
  - Manual: Use the “Sync now” button on the Dashboard CVE Feed card
  - Automatic: Daily at 02:00 WIB (Asia/Jakarta)
  - With API key: 50 requests/30s, ~1s delay between pages, up to ~2000 CVEs per run
  - Without API key: ~5 requests/30s, ~7s delay, ~300 CVEs per run
- UI features:
  - Dashboard CVE Feed: severity distribution, last 7 days count, 90-day totals, last sync time (Jakarta), and recent CVEs
  - CVE Database page: keyword search, year filter, multi-severity selection (including UNASSIGNED), published date range, “Hide Rejected CVEs”, pagination (50/page), and rich details (CVSS v3/v2, CWE, references, affected products)
- Setup (recommended):
  1. Add your NVD API key via Settings → API Keys (or set NVD_API_KEY in `.env`)
  2. Deploy services and login
  3. Trigger the initial sync from the dashboard CVE card
- API endpoints (via gateway):
  - GET `/api/cve/stats`
  - GET `/api/cve/recent?limit=10`
  - GET `/api/cve/search?keyword=&year=&severity=&min_cvss=&max_cvss=&limit=&offset=&hide_rejected=`
  - GET `/api/cve/year/:year?limit=&offset=`
  - GET `/api/cve/severity/:severity?limit=&offset=`
  - POST `/api/cve/sync?days=7`

Notes:
- NVD “rejected” entries are automatically filtered in many views and can be hidden in search.
- Last sync time is shown in Asia/Jakarta timezone on the dashboard.
