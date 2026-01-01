#!/bin/sh
set -e

# Defaults (may be overridden by Settings model via Python helper)
RQ_WORKERS="${RQ_WORKERS:-5}"
RQ_QUEUES="${RQ_QUEUES:-default}"
REDIS_URL="${REDIS_URL:-redis://redis:6379/0}"
JOB_TIMEOUT="${JOB_TIMEOUT:-3600}"

# Resolve desired worker count from DB via helper script (prints integer to stdout)
# Falls back to env RQ_WORKERS if DB not available or script fails
RW_FROM_DB="$(python /app/backend/workers/worker_settings.py 2>/dev/null || echo "${RQ_WORKERS}")"

# Sanitize and set final worker count
if echo "$RW_FROM_DB" | grep -E '^[0-9]+$' >/dev/null 2>&1; then
  RQ_WORKERS="$RW_FROM_DB"
fi

echo "Resolved RW_FROM_DB=${RW_FROM_DB} -> RQ_WORKERS=${RQ_WORKERS}"
echo "Starting ${RQ_WORKERS} RQ worker process(es) for queues: '${RQ_QUEUES}' using Redis: ${REDIS_URL}"

pids=""
i=1
while [ "$i" -le "$RQ_WORKERS" ]; do
  echo "Launching worker $i..."
  rq worker -u "${REDIS_URL}" ${RQ_QUEUES} &
  pids="$pids $!"
  i=$((i+1))
done

trap 'echo "Stopping workers..."; kill $pids; wait' TERM INT

# Wait on all worker processes
wait