#!/bin/bash
# FITD Local Development Launcher
# Starts all services and the React frontend in background processes.
# Usage: ./start-dev.sh           — install deps + start everything
#        ./start-dev.sh stop      — kill all services
#        ./start-dev.sh --skip-install  — start without installing deps

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT_DIR/.dev-logs"
mkdir -p "$LOG_DIR"

# ── Shared environment variables ─────────────────────────────────────────────
# Auth backend and db_service read from their own .env files via load_dotenv().
# The other services need these injected.

if [ -z "$JWT_SECRET_KEY" ]; then
    echo "ERROR: JWT_SECRET_KEY not set. Export it or add to .env before running."
    exit 1
fi
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export AUTH_SERVICE_URL="http://localhost:2468"
export DB_SERVICE_URL="http://localhost:8000"
export FRONTEND_URL="http://localhost:3000"

# ── Stop mode ────────────────────────────────────────────────────────────────
if [ "$1" = "stop" ]; then
    echo "Stopping all FITD services..."
    if [ -f "$LOG_DIR/pids" ]; then
        while read -r pid; do
            kill "$pid" 2>/dev/null && echo "  Stopped PID $pid" || true
        done < "$LOG_DIR/pids"
        rm "$LOG_DIR/pids"
    fi
    echo "Done."
    exit 0
fi

# ── Preflight checks ────────────────────────────────────────────────────────
echo "=== FITD Local Dev ==="
echo ""

# Check Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "WARNING: Redis is not running. Auth sessions will fail."
    echo "  Start it with: redis-server"
    echo ""
fi

# Check conda env
echo "Active conda env: ${CONDA_DEFAULT_ENV:-none}"
echo ""

# ── Install dependencies ─────────────────────────────────────────────────────
SKIP_INSTALL=false
if [ "$1" = "--skip-install" ]; then
    SKIP_INSTALL=true
fi

SERVICES=("api_service" "generation_service" "media_service")

if [ "$SKIP_INSTALL" = false ]; then
    echo "Installing Python dependencies..."

    # Install local packages (editable)
    pip install -e "$ROOT_DIR/fitd_schemas" -q 2>&1 | tail -1
    pip install -e "$ROOT_DIR/jwt_auth" -q 2>&1 | tail -1

    for svc in "${SERVICES[@]}"; do
        if [ -f "$ROOT_DIR/$svc/requirements.txt" ]; then
            echo "  $svc"
            pip install -r "$ROOT_DIR/$svc/requirements.txt" -q 2>&1 | tail -1
        fi
    done

    echo ""
    echo "Installing frontend dependencies..."
    cd "$ROOT_DIR/shopify-redux"
    npm install --silent 2>&1 | tail -1
    cd "$ROOT_DIR"

    echo ""
fi

# ── Kill any leftover processes on service ports ─────────────────────────────
for port in 8000 1234 1235 1236 3000; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "Killing leftover process on port $port (PID $pid)"
        kill $pid 2>/dev/null || true
        sleep 0.5
    fi
done

# ── Launch services ──────────────────────────────────────────────────────────
> "$LOG_DIR/pids"  # Clear pid file

start_service() {
    local name="$1"
    local dir="$2"
    local cmd="$3"
    local port="$4"

    echo "Starting $name on port $port..."
    cd "$dir"
    $cmd > "$LOG_DIR/$name.log" 2>&1 &
    local pid=$!
    echo "$pid" >> "$LOG_DIR/pids"
    echo "  PID $pid  (log: .dev-logs/$name.log)"
    cd "$ROOT_DIR"
}

# api_service        :8000
start_service "api_service" \
    "$ROOT_DIR/api_service" \
    "python main.py" \
    8000

# meshy_backend     :1234
start_service "meshy_backend" \
    "$ROOT_DIR/meshy_backend" \
    "python main.py" \
    1234

# media_service      :1235
start_service "media_service" \
    "$ROOT_DIR/media_service" \
    "python main.py" \
    1235

# cad_service       :1236
start_service "cad_service" \
    "$ROOT_DIR/cad_service" \
    "python main.py" \
    1236

# React frontend    :3000
echo "Starting frontend on port 3000..."
cd "$ROOT_DIR/shopify-redux"
npm start > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >> "$LOG_DIR/pids"
echo "  PID $FRONTEND_PID  (log: .dev-logs/frontend.log)"
cd "$ROOT_DIR"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "All services started:"
echo "  api_service      http://localhost:8000"
echo "  meshy_backend    http://localhost:1234"
echo "  stripe_service   http://localhost:100"
echo "  media_service    http://localhost:1235"
echo "  cad_service      http://localhost:1236"
echo "  frontend         http://localhost:3000"
echo ""
echo "Logs:   .dev-logs/<service>.log"
echo "Stop:   ./start-dev.sh stop"
echo ""
echo "Tailing all logs (Ctrl+C to detach — services keep running)..."
echo ""
tail -f "$LOG_DIR"/*.log
