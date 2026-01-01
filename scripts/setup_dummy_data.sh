#!/bin/bash
# Setup script for IntelX Scanner with dummy data
# This script automates the complete setup process

set -e  # Exit on error

echo "=============================================================================="
echo "IntelX Scanner - Dummy Data Setup"
echo "=============================================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it first."
    exit 1
fi

print_success "Docker Compose found"

# Step 1: Start services
print_info "Step 1/5: Starting Docker services..."
docker-compose up -d

print_success "Services started"

# Step 2: Wait for services to be ready
print_info "Step 2/5: Waiting for services to be ready..."
echo "Waiting for PostgreSQL..."
sleep 5

# Check if postgres is ready
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T postgres pg_isready -U scanner &> /dev/null; then
        print_success "PostgreSQL is ready"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    print_error "PostgreSQL failed to start within timeout"
    exit 1
fi

# Wait a bit more for backend to be ready
print_info "Waiting for backend service..."
sleep 10

# Step 3: Generate dummy data
print_info "Step 3/5: Generating up to 120k dummy credentials..."
echo "This may take 2-5 minutes..."

if docker-compose exec -T backend python cli.py --generate-dummy; then
    print_success "Dummy data generated successfully"
else
    print_error "Failed to generate dummy data"
    exit 1
fi

# Step 4: Import dummy data
print_info "Step 4/5: Importing dummy data into database..."
echo "This may take 5-15 minutes..."

if docker-compose exec -T backend python cli.py --import-dummy dummy_credentials.json; then
    print_success "Dummy data imported successfully"
else
    print_error "Failed to import dummy data"
    exit 1
fi

# Step 5: Verify setup
print_info "Step 5/5: Verifying setup..."

# Check if admin user exists
if docker-compose exec -T postgres psql -U scanner -d intelx_scanner -t -c "SELECT COUNT(*) FROM users WHERE role='admin';" | grep -q "1"; then
    print_success "Admin user exists"
else
    print_warning "Admin user not found. Please create via setup.sh or CLI."
fi

# Check credential count
cred_count=$(docker-compose exec -T postgres psql -U scanner -d intelx_scanner -t -c "SELECT COUNT(*) FROM credentials;" | tr -d ' ')
print_success "Total credentials in database: $cred_count"

# Final summary
echo ""
echo "=============================================================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "=============================================================================="
echo ""
echo "Application is ready at: https://localhost:8443"
echo ""
echo "Login information:"
echo "  Use the admin credentials you created during setup"
echo ""
echo "What's included:"
echo "  - Up to 120,000 unique credentials"
echo "  - 10 dummy scan jobs"
echo "  - 5 dummy scheduled jobs"
echo "  - Realistic data distribution (30% .id domains, 70% international)"
echo ""
echo "Next steps:"
echo "  1. Open https://localhost:8443 in your browser"
echo "  2. Login with your admin credentials"
echo "  3. Explore the dashboard, credentials, and organizations"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f backend"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo ""
echo "For more information, see DUMMY_DATA_SETUP.md"
echo "=============================================================================="