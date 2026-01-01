#!/bin/bash
# CredentialLake Setup Script

set -euo pipefail

# Colors and Styles
# Use ANSI-C quoting to ensure ESC sequences render correctly.
# Fallback to no-color when stdout is not a TTY.
if [[ -t 1 ]]; then
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[1;33m'
  RED=$'\033[0;31m'
  BLUE=$'\033[0;34m'
  CYAN=$'\033[0;36m'
  MAGENTA=$'\033[0;35m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  NC=$'\033[0m'
else
  GREEN=''
  YELLOW=''
  RED=''
  BLUE=''
  CYAN=''
  MAGENTA=''
  BOLD=''
  DIM=''
  NC=''
fi

# Icons (Unicode)
ICON_CHECK="✓"
ICON_CROSS="✗"
ICON_ARROW="→"
ICON_STAR="★"
ICON_GEAR="⚙"
ICON_ROCKET="🚀"
ICON_LOCK="🔒"
ICON_INFO="ℹ"
ICON_WARN="⚠"

# Logging functions with icons
info()    { echo -e "${BLUE}${ICON_INFO}${NC}  $1"; }
warn()    { echo -e "${YELLOW}${ICON_WARN}${NC}  $1"; }
error()   { echo -e "${RED}${ICON_CROSS}${NC}  $1"; }
success() { echo -e "${GREEN}${ICON_CHECK}${NC}  $1"; }
step()    { echo -e "${CYAN}${ICON_ARROW}${NC}  ${BOLD}$1${NC}"; }

# Print a fancy header
print_header() {
  local title="$1"
  local title_length=${#title}
  local padding=$((58 - title_length))
  
  echo ""
  echo -e "${CYAN}============================================================${NC}"
  printf "${BOLD}${GREEN}%s${NC}\n" "$title"
  echo -e "${CYAN}============================================================${NC}"
  echo ""
}

# Print a banner
print_banner() {
  clear || true
  echo ""
  echo -e "${BOLD}${CYAN}===========================================================${NC}"
  echo -e "${BOLD}${GREEN}CredentialLake${NC} - Automated Setup Wizard"
  echo -e "${DIM}Secure Credential Monitoring & Management${NC}"
  echo -e "${BOLD}${CYAN}===========================================================${NC}"
  echo ""
}

# Progress bar
show_progress() {
  local current=$1
  local total=$2
  local width=50
  local percentage=$((current * 100 / total))
  local filled=$((width * current / total))
  local empty=$((width - filled))
  
  printf "\r${CYAN}Progress: [${NC}"
  printf "%${filled}s" | tr ' ' '█'
  printf "%${empty}s" | tr ' ' '░'
  printf "${CYAN}]${NC} ${BOLD}%3d%%${NC}" "$percentage"
}

# 1) Detect OS
detect_os() {
  print_header "Step 1/7: Detecting Operating System"
  step "Analyzing system environment..."
  
  local ost="${OSTYPE:-}"
  if [[ "$ost" == "linux-gnu"* ]]; then
    if [[ -f /etc/os-release ]]; then
      . /etc/os-release
      OS_ID="${ID:-linux}"
      OS_NAME="${NAME:-Linux}"
      success "Detected ${BOLD}${OS_NAME}${NC} (${OS_ID})"
    else
      OS_ID="linux"
      success "Detected ${BOLD}Linux${NC}"
    fi
  elif [[ "$ost" == "darwin"* ]]; then
    OS_ID="macos"
    success "Detected ${BOLD}macOS${NC}"
  elif [[ "$ost" == "msys" || "$ost" == "cygwin" ]]; then
    OS_ID="windows"
    error "Windows detected. Please use ${BOLD}WSL2${NC} or run on Linux/macOS."
    echo ""
    echo -e "${DIM}For WSL2 setup instructions, visit:${NC}"
    echo -e "${BLUE}https://docs.microsoft.com/en-us/windows/wsl/install${NC}"
    exit 1
  else
    OS_ID="unknown"
    warn "Unknown OS. Attempting generic setup..."
  fi
  echo ""
}

# 2) Check Docker
command_exists() { command -v "$1" >/dev/null 2>&1; }

install_docker_linux() {
  print_header "Installing Docker on Linux"
  step "Setting up Docker repository and packages..."
  echo ""
  
  case "${OS_ID}" in
    ubuntu|debian)
      sudo apt-get update
      sudo apt-get install -y ca-certificates curl gnupg lsb-release
      sudo install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/${OS_ID}/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      sudo chmod a+r /etc/apt/keyrings/docker.gpg
      echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS_ID} \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    fedora|rhel|centos)
      sudo dnf -y install dnf-plugins-core
      sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo || true
      sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    arch)
      sudo pacman -Sy --noconfirm docker docker-compose
      ;;
    *)
      error "Unsupported Linux distribution. Please install Docker manually."
      exit 1
      ;;
  esac
  sudo systemctl enable docker || true
  sudo systemctl start docker || true
  sudo usermod -aG docker "$USER" || true
  success "Docker installed. You may need to log out/in for group permissions."
}

install_docker_macos() {
  print_header "Installing Docker on macOS"
  if ! command_exists brew; then
    step "Homebrew not found. Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    success "Homebrew installed"
  fi
  
  step "Installing Docker Desktop via Homebrew..."
  brew install --cask docker
  success "Docker Desktop installed"
  echo ""
  warn "Please ${BOLD}start Docker Desktop${NC} from your Applications folder"
  echo ""
  read -p "Press ${BOLD}Enter${NC} once Docker Desktop is running..." _
}

check_docker() {
  print_header "Step 2/7: Checking Docker Installation"
  step "Verifying Docker availability..."
  
  if command_exists docker; then
    success "Docker is installed: ${BOLD}$(docker --version)${NC}"
  else
    warn "Docker is not installed. Starting installation..."
    echo ""
    if [[ "${OS_ID}" == "macos" ]]; then
      install_docker_macos
    elif [[ "${OS_ID}" == "ubuntu" || "${OS_ID}" == "debian" || "${OS_ID}" == "fedora" || "${OS_ID}" == "rhel" || "${OS_ID}" == "centos" || "${OS_ID}" == "arch" ]]; then
      install_docker_linux
    else
      error "Unsupported OS for automated install. Please install Docker manually."
      exit 1
    fi
  fi

  echo ""
  
  # Ensure Docker daemon is running
  step "Checking Docker daemon status..."
  if ! docker info >/dev/null 2>&1; then
    if [[ "${OS_ID}" == "macos" ]]; then
      warn "Docker Desktop is not running"
      echo ""
      echo -e "${DIM}Please start Docker Desktop and wait for it to be ready${NC}"
      read -p "Press ${BOLD}Enter${NC} once Docker Desktop is running..." _
    else
      info "Starting Docker service..."
      sudo systemctl start docker || true
    fi
  fi
  success "Docker daemon is running"

  # Check Docker Compose V2
  step "Verifying Docker Compose..."
  if docker compose version >/dev/null 2>&1; then
    success "Docker Compose available: ${BOLD}$(docker compose version | head -n1)${NC}"
  else
    error "Docker Compose V2 not available"
    echo ""
    echo -e "${DIM}Please install Docker Compose plugin:${NC}"
    echo -e "${BLUE}https://docs.docker.com/compose/install/${NC}"
    exit 1
  fi
  echo ""
}

# 3) Environment setup (minimal)
setup_env() {
  print_header "Step 3/7: Environment Configuration"
  
  if [[ ! -f ".env" ]]; then
    step "Creating environment file from template..."
    cp .env.example .env
    success "Created ${BOLD}.env${NC} from template"
    
    # Generate secure JWT secret
    step "Generating secure JWT secret..."
    local JWT_SECRET
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | fold -w 64 | head -n 1)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${JWT_SECRET}|" .env
    else
      sed -i "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${JWT_SECRET}|" .env
    fi
    success "Generated secure JWT secret (64 characters)"
  else
    info "Environment file ${BOLD}.env${NC} already exists"
    warn "Skipping environment setup to preserve existing configuration"
  fi
  echo ""
}

# 4) Resource-based suggestions (RAM/CPU -> recommended container tuning)
get_total_ram_gb() {
  local gb=0
  if [[ "${OS_ID:-}" == "macos" ]]; then
    local bytes
    bytes=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    if [[ -n "$bytes" && "$bytes" != "0" ]]; then
      gb=$(( bytes / 1024 / 1024 / 1024 ))
    fi
  else
    # Linux
    gb=$(free -m 2>/dev/null | awk '/Mem:/ {print int($2/1024)}')
    gb=${gb:-0}
  fi
  echo "${gb}"
}

get_cpu_cores() {
  local cores=1
  if command -v nproc >/dev/null 2>&1; then
    cores=$(nproc)
  elif [[ "${OS_ID:-}" == "macos" ]]; then
    cores=$(sysctl -n hw.ncpu 2>/dev/null || echo 1)
  fi
  echo "${cores}"
}

resource_suggestions() {
  print_header "Step 4/7: System Resource Analysis"
  step "Analyzing system resources..."
  
  local ram_gb cores
  ram_gb=$(get_total_ram_gb)
  cores=$(get_cpu_cores)

  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  System Resources Detected${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  RAM:        ${BOLD}${ram_gb} GB${NC}"
  echo -e "  CPU Cores:  ${BOLD}${cores}${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Recommend Elasticsearch heap size based on RAM
  if (( ram_gb >= 16 )); then
    RECOMMENDED_ES_JAVA="-Xms2g -Xmx2g"
  elif (( ram_gb >= 8 )); then
    RECOMMENDED_ES_JAVA="-Xms1g -Xmx1g"
  else
    RECOMMENDED_ES_JAVA="-Xms512m -Xmx512m"
  fi

  # Recommend worker process count based on cores
  RECOMMENDED_WORKERS=$(( cores > 2 ? cores - 1 : 2 ))
  (( RECOMMENDED_WORKERS > 10 )) && RECOMMENDED_WORKERS=10

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  Recommended Configuration${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${ICON_GEAR} Elasticsearch Heap:"
  echo -e "    ${GREEN}${RECOMMENDED_ES_JAVA}${NC}"
  echo ""
  echo -e "  ${ICON_GEAR} Worker Processes:"
  echo -e "    ${GREEN}${RECOMMENDED_WORKERS} workers${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  info "These settings will optimize performance for your system"
  echo ""
}

apply_es_heap() {
  # Update ES_JAVA_OPTS in docker-compose.yml
  local val="${RECOMMENDED_ES_JAVA:-}"
  if [[ -z "${val}" ]]; then
    warn "No recommended ES heap value available."
    return 1
  fi
  if [[ ! -f "docker-compose.yml" ]]; then
    error "docker-compose.yml not found."
    return 1
  fi
  # Backup docker-compose.yml before modifying
  local ts
  ts=$(date +%Y%m%d_%H%M%S)
  cp docker-compose.yml "docker-compose.yml.bak.${ts}"
  success "Backed up docker-compose.yml to docker-compose.yml.bak.${ts}"
  if [[ "${OS_ID:-}" == "macos" ]]; then
    sed -i '' "s|ES_JAVA_OPTS=.*|ES_JAVA_OPTS=${val}|" docker-compose.yml
  else
    sed -i "s|ES_JAVA_OPTS=.*|ES_JAVA_OPTS=${val}|" docker-compose.yml
  fi
  success "Applied ES_JAVA_OPTS=${val} in docker-compose.yml"
}

apply_workers_env() {
  # Ensure .env and set RQ_WORKERS to recommended value
  local val="${RECOMMENDED_WORKERS:-}"
  if [[ -z "${val}" ]]; then
    warn "No recommended worker count available."
    return 1
  fi
  if [[ ! -f ".env" ]]; then
    cp .env.example .env
    success "Created .env from template"
  fi

  # Backup .env before modifying
  local ts
  ts=$(date +%Y%m%d_%H%M%S)
  cp .env ".env.bak.${ts}"
  success "Backed up .env to .env.bak.${ts}"

  if grep -qE '^RQ_WORKERS=' .env; then
    if [[ "${OS_ID:-}" == "macos" ]]; then
      sed -i '' "s|^RQ_WORKERS=.*|RQ_WORKERS=${val}|" .env
    else
      sed -i "s|^RQ_WORKERS=.*|RQ_WORKERS=${val}|" .env
    fi
  else
    echo "RQ_WORKERS=${val}" >> .env
  fi
  success "Applied RQ_WORKERS=${val} in .env (restart worker to take effect)"
}

prompt_tuning() {
  print_header "Step 5/7: Performance Optimization"
  
  echo "Would you like to apply the recommended Elasticsearch heap settings?"
  echo -e "${DIM}(${RECOMMENDED_ES_JAVA} in docker-compose.yml)${NC}"
  echo ""
  read -r -p "Apply optimization? [Y/n]: " ans
  ans="${ans:-y}"
  
  if [[ "${ans}" =~ ^[Yy]$ ]]; then
    apply_es_heap
    echo ""
  else
    info "Keeping default Elasticsearch heap settings"
    echo ""
  fi

  echo "Would you like to apply the recommended worker process count?"
  echo -e "${DIM}(RQ_WORKERS=${RECOMMENDED_WORKERS} in .env)${NC}"
  echo ""
  read -r -p "Apply optimization? [Y/n]: " ans2
  ans2="${ans2:-y}"
  
  if [[ "${ans2}" =~ ^[Yy]$ ]]; then
    apply_workers_env
    echo ""
  else
    info "Keeping default worker process count"
    echo ""
  fi
}

# Ensure Docker daemon is running and ready
ensure_docker_running() {
  print_header "Verifying Docker Daemon"
  step "Checking Docker daemon status..."
  
  local attempts=0
  local max_attempts=60  # ~120 seconds total
  
  while (( attempts < max_attempts )); do
    if docker info >/dev/null 2>&1; then
      success "Docker daemon is ${BOLD}ready${NC}"
      echo ""
      return 0
    fi
    
    attempts=$((attempts + 1))
    
    if [[ "${OS_ID:-}" == "macos" ]]; then
      if (( attempts == 1 )); then
        warn "Docker Desktop is not running"
        echo ""
        echo -e "${DIM}Please start Docker Desktop from Applications${NC}"
        echo ""
      fi
      printf "\r${CYAN}⏳${NC} Waiting for Docker Desktop... (${attempts}/${max_attempts})"
      read -t 2 -r _ 2>/dev/null || true
    else
      printf "\r${CYAN}⏳${NC} Waiting for Docker service... (${attempts}/${max_attempts})"
      sleep 2
      # Try to start service if possible
      sudo systemctl start docker >/dev/null 2>&1 || true
    fi
  done
  
  echo ""
  error "Docker daemon did not become ready in time"
  echo ""
  echo -e "${DIM}Please ensure Docker is installed and running, then try again${NC}"
  exit 1
}

# Detect existing deployment and offer rebuild/cancel
handle_existing_deployment() {
  print_header "Step 6/7: Deployment Check"
  step "Scanning for existing deployment..."
  
  local found=0

  # Prefer compose status; fallback to container name scan
  local ps_out
  ps_out=$(docker compose ps 2>/dev/null || echo "")
  if echo "$ps_out" | grep -E "Up|running" >/dev/null 2>&1; then
    found=1
  else
    if docker ps --format '{{.Names}}' | grep -E '^credlake_' >/dev/null 2>&1; then
      found=1
    fi
  fi

  if (( found == 1 )); then
    echo ""
    warn "Existing deployment detected!"
    echo ""
    echo -e "${BOLD}Would you like to rebuild the containers?${NC}"
    echo -e "${DIM}This will stop existing containers and rebuild them${NC}"
    echo -e "${DIM}Command: docker compose down && docker compose up -d --build${NC}"
    echo ""
    read -r -p "Rebuild containers? [y/N]: " ans
    ans="${ans:-n}"
    
    if [[ "${ans}" =~ ^[Yy]$ ]]; then
      echo ""
      step "Stopping existing deployment..."
      docker compose down || true
      success "Stopped existing containers"
      echo ""
      step "Rebuilding and starting containers..."
      docker compose up -d --build
      success "Rebuild complete"
      echo ""
      # Continue to wait_for_ready afterwards in main
    else
      echo ""
      warn "Setup cancelled by user"
      echo ""
      echo -e "${DIM}To rebuild later, run: ${BOLD}docker compose up -d --build${NC}"
      exit 0
    fi
  else
    success "No existing deployment found"
    echo ""
  fi
}

start_services() {
  print_header "Step 7/7: Starting Services"
  
  echo -e "${BOLD}${ICON_ROCKET} Ready to launch CredentialLake!${NC}"
  echo ""
  echo -e "${DIM}This will build and start all containers${NC}"
  echo -e "${DIM}First run may take several minutes to download images${NC}"
  echo ""

  # Small interactive pause to allow cancel or immediate start
  if [ -t 1 ]; then
    echo -e "Press ${BOLD}Enter${NC} to start now, or ${BOLD}Ctrl+C${NC} to cancel"
    read -t 3 -p "Starting automatically in 3 seconds..." _ 2>/dev/null || true
  else
    sleep 2
  fi

  echo ""
  step "Building and starting containers..."
  echo ""
  
  # Run docker compose with output
  docker compose up -d --build
  
  echo ""
  success "All containers started successfully"
  echo ""
}

# 5) Wait until running and finished
wait_for_ready() {
  print_header "Service Health Check"

  local timeout=600   # seconds
  local interval=10   # seconds
  local elapsed=0
  local total_services=6

  step "Waiting for all services to become healthy..."
  echo ""

  while (( elapsed < timeout )); do
    local healthy=0
    local unhealthy=0
    
    # Check each service
    docker compose ps gateway | grep -E "healthy|Up" >/dev/null 2>&1 && healthy=$((healthy+1)) || unhealthy=$((unhealthy+1))
    docker compose ps backend | grep -E "healthy|Up" >/dev/null 2>&1 && healthy=$((healthy+1)) || unhealthy=$((unhealthy+1))
    docker compose ps elasticsearch | grep -E "healthy|Up" >/dev/null 2>&1 && healthy=$((healthy+1)) || unhealthy=$((unhealthy+1))
    docker compose ps postgres | grep -E "healthy|Up" >/dev/null 2>&1 && healthy=$((healthy+1)) || unhealthy=$((unhealthy+1))
    docker compose ps redis | grep -E "healthy|Up" >/dev/null 2>&1 && healthy=$((healthy+1)) || unhealthy=$((unhealthy+1))
    docker compose ps proxy | grep -E "Up" >/dev/null 2>&1 && healthy=$((healthy+1)) || unhealthy=$((unhealthy+1))

    if (( unhealthy == 0 )); then
      echo ""
      success "All services are ${BOLD}healthy${NC} and running"
      break
    fi

    # Show progress
    show_progress "$healthy" "$total_services"
    
    elapsed=$((elapsed + interval))
    sleep "${interval}"
  done

  if (( elapsed >= timeout )); then
    echo ""
    warn "Timeout waiting for services"
    echo ""
    echo -e "${DIM}Check logs with: ${BOLD}docker compose logs -f${NC}"
  fi

  # Final external availability check (only exposed port): HTTPS 8443
  echo ""
  step "Verifying HTTPS endpoint..."
  if curl -skI https://localhost:8443 | grep -E "^HTTP/1.1 2|^HTTP/2 2" >/dev/null 2>&1; then
    success "HTTPS endpoint is ${BOLD}reachable${NC} at https://localhost:8443"
  else
    warn "HTTPS endpoint not responding yet. It may still be initializing..."
    echo -e "${DIM}Wait a moment and try accessing: ${BOLD}https://localhost:8443${NC}"
  fi
  echo ""
}

final_message() {
  print_header "Setup Complete!"
  
  echo -e "${GREEN}${ICON_CHECK}${NC} ${BOLD}CredentialLake is now running!${NC}"
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  Access Your Application${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${ICON_LOCK} HTTPS: ${BOLD}${GREEN}https://localhost:8443${NC}"
  echo ""
  echo -e "  ${DIM}Only port 8443 is exposed externally${NC}"
  echo -e "  ${DIM}All other services are internal${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  Common Commands${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  View status:   ${BOLD}docker compose ps${NC}"
  echo -e "  View logs:     ${BOLD}docker compose logs -f${NC}"
  echo -e "  Stop services: ${BOLD}docker compose down${NC}"
  echo -e "  Rebuild:       ${BOLD}docker compose up -d --build${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  echo -e "${BLUE}${ICON_INFO}${NC}  Dummy data can be set up later via the Web UI"
  echo ""
  echo -e "${GREEN}${ICON_STAR}${NC}  ${BOLD}Happy credential monitoring!${NC}"
  echo ""
}

main() {
  # Graceful cancel handling (Ctrl+C)
  trap 'echo -e "\n${YELLOW}${ICON_WARN}${NC} Setup cancelled by user. No changes were applied."; exit 130' INT

  print_banner
  detect_os
  sleep 1
  check_docker
  sleep 1
  ensure_docker_running
  sleep 1
  setup_env
  sleep 1
  resource_suggestions
  sleep 1
  prompt_tuning
  sleep 1
  handle_existing_deployment
  sleep 1
  start_services
  wait_for_ready
  final_message
}

main