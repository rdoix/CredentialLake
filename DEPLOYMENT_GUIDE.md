# CredLeak Deployment Guide

## Quick Start

### Prerequisites
- Docker 20.10 or higher
- Docker Compose 2.0 or higher
- At least 4GB RAM available
- Port 8443 available (HTTPS). Internal services run without host port exposure.

### One-Command Deployment

```bash
./setup.sh
```

This enhanced setup script will:
1. **Detect your operating system** (Linux, macOS, Windows/WSL2)
2. **Install Docker** automatically if not present
3. **Configure environment** with secure JWT secrets
4. **Analyze system resources** (RAM, CPU cores)
5. **Recommend optimizations** for Elasticsearch and workers
6. **Build and start all services** with progress tracking
7. **Health check** all containers until ready
8. **Display access URLs** and useful commands

The script features:
- ✨ **Interactive UI** with colored output and progress indicators
- 🔍 **Smart detection** of existing deployments
- ⚙️ **Performance tuning** based on your system resources
- 🎯 **Step-by-step guidance** (7 clear steps)
- 🛡️ **Safe defaults** with option to customize

### Manual Deployment

If you prefer manual deployment:

```bash
# 1. Create environment file
cp .env.example .env

# 2. Edit .env and add your configurations
nano .env  # or use your preferred editor

# 3. Create directories
mkdir -p logs exports

# 4. Start services
docker-compose up -d --build

# 5. Check status
docker-compose ps
```

## Container Names

All containers use the `credlake_` prefix:

- `credlake_postgres` - PostgreSQL database
- `credlake_redis` - Redis job queue
- `credlake_elasticsearch` - Elasticsearch search engine
- `credlake_backend` - FastAPI backend
- `credlake_worker` - Background job worker
- `credlake_gateway` - NestJS API gateway
- `credlake_frontend` - Next.js frontend

## Access URLs

After successful deployment:

- **Frontend UI (HTTPS)**: https://localhost:8443
- Note: Gateway (3001), Backend (8000), PostgreSQL (5432), Redis (6379), and Elasticsearch (9200) are internal-only and not exposed on the host.

## Environment Configuration

### Required Variables

Edit `.env` file and configure:

```bash
# Database password (change in production)
DB_PASSWORD=your_secure_password

# IntelX API key (required for scanning)
INTELX_KEY=your_intelx_api_key

# JWT secret (change in production)
JWT_SECRET_KEY=your_secure_random_string

# Optional: Microsoft Teams webhook
TEAMS_WEBHOOK_URL=your_teams_webhook_url
```

### Optional Variables

```bash
# Worker configuration
RQ_WORKERS=5  # Number of parallel workers
RQ_QUEUES=default  # Queue names

# Node environment
NODE_ENV=production
```

## Service Health Checks

All services include health checks:

- **PostgreSQL**: Ready check on port 5432
- **Redis**: Ping check
- **Elasticsearch**: Cluster health check
- **Backend**: HTTP health endpoint
- **Gateway**: HTTP health endpoint

Services will automatically restart if health checks fail.

## Startup Order

Services start in the correct order with dependencies:

1. PostgreSQL & Redis (with health checks)
2. Elasticsearch (with health check)
3. Backend (depends on PostgreSQL & Redis)
4. Worker (depends on Backend)
5. Gateway (depends on Backend & Elasticsearch)
6. Frontend (depends on Gateway)

## Useful Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f credlake_backend
docker-compose logs -f credlake_worker
docker-compose logs -f credlake_frontend
```

### Service Management

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# Restart specific service
docker-compose restart credlake_backend

# Rebuild and restart
docker-compose up -d --build
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it credlake_postgres psql -U scanner -d intelx_scanner

# View database tables
docker exec -it credlake_postgres psql -U scanner -d intelx_scanner -c "\dt"
```

### Redis Access

```bash
# Connect to Redis CLI
docker exec -it credlake_redis redis-cli

# Check queue status
docker exec -it credlake_redis redis-cli LLEN rq:queue:default
```

### Container Shell Access

```bash
# Backend shell
docker exec -it credlake_backend bash

# Worker shell
docker exec -it credlake_worker bash

# Frontend shell
docker exec -it credlake_frontend sh
```

## Troubleshooting

### Services Not Starting

1. Check if ports are available:
```bash
lsof -i :8443
```

2. Check Docker resources:
```bash
docker system df
docker system prune  # Clean up if needed
```

3. View service logs:
```bash
docker-compose logs credlake_backend
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps credlake_postgres

# Check PostgreSQL logs
docker-compose logs credlake_postgres

# Verify connection
docker exec credlake_postgres pg_isready -U scanner
```

### Elasticsearch Issues

```bash
# Check Elasticsearch health
curl http://localhost:9200/_cluster/health

# Increase memory if needed (in docker-compose.yml)
ES_JAVA_OPTS=-Xms1g -Xmx1g
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker-compose logs -f credlake_worker

# Check Redis connection
docker exec credlake_worker python -c "import redis; r=redis.from_url('redis://redis:6379/0'); print(r.ping())"

# Restart worker
docker-compose restart credlake_worker
```

### Frontend Build Issues

```bash
# Rebuild frontend
docker-compose up -d --build credlake_frontend

# Check build logs
docker-compose logs credlake_frontend
```

## Network Configuration

All services run on a dedicated bridge network: `credleak_network`

This provides:
- Service isolation
- DNS resolution between containers
- Network security

## Data Persistence

Persistent volumes:
- `postgres_data` - Database data
- `redis_data` - Redis persistence
- `esdata` - Elasticsearch indices
- `./logs` - Application logs (host mount)
- `./exports` - Export files (host mount)

## Security Considerations

### Production Deployment

1. **Change default passwords**:
   - Database password in `.env`
   - JWT secret key

2. **Use HTTPS**:
   - Add reverse proxy (nginx/traefik)
   - Configure SSL certificates

3. **Restrict network access**:
   - Remove port mappings for internal services
   - Use firewall rules

4. **Enable authentication**:
   - Configure user authentication
   - Set up role-based access control

5. **Regular backups**:
   - Backup PostgreSQL database
   - Backup Elasticsearch indices

### Backup Commands

```bash
# Backup PostgreSQL
docker exec credlake_postgres pg_dump -U scanner intelx_scanner > backup.sql

# Restore PostgreSQL
docker exec -i credlake_postgres psql -U scanner intelx_scanner < backup.sql

# Backup volumes
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

## Monitoring

### Check Service Status

```bash
# All services
docker-compose ps

# Detailed stats
docker stats
```

### Health Endpoints

- Only HTTPS 8443 is exposed externally. Use:
  - Service status: `docker compose ps`
  - Service logs: `docker compose logs -f`
  - Container health status is managed internally via Docker Compose healthchecks.

## Updating

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Or use deploy script
./setup.sh
```

## Clean Installation

To start fresh:

```bash
# Stop and remove everything
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Clean Docker system
docker system prune -a

# Deploy again
./setup.sh
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Verify environment variables in `.env`
3. Ensure all ports are available
4. Check Docker resources (memory, disk)

## Performance Tuning

### Worker Scaling

Adjust worker count in `.env`:
```bash
RQ_WORKERS=10  # Increase for more parallel processing
```

### Database Optimization

```bash
# Increase PostgreSQL connections (in docker-compose.yml)
POSTGRES_MAX_CONNECTIONS=200
```

### Elasticsearch Memory

```bash
# Adjust heap size (in docker-compose.yml)
ES_JAVA_OPTS=-Xms2g -Xmx2g