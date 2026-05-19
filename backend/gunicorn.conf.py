import multiprocessing
import os

# Server socket
bind     = f"0.0.0.0:{os.getenv('PORT', '3001')}"
backlog  = 2048

# Worker processes
worker_class     = "uvicorn.workers.UvicornWorker"
workers          = int(os.getenv("WORKERS", max(2, multiprocessing.cpu_count())))
worker_connections = 1000
max_requests     = 1000
max_requests_jitter = 50
timeout          = 120
graceful_timeout = 30
keepalive        = 5

# Logging
accesslog  = "-"
errorlog   = "-"
loglevel   = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)sµs'

# Process naming
proc_name = "ReleaseOps"

# Security
limit_request_line   = 4094
limit_request_fields = 100

# Hooks
def on_starting(server):
    server.log.info("ReleaseOps starting up")

def on_exit(server):
    server.log.info("ReleaseOps shutting down")

def worker_exit(server, worker):
    server.log.info(f"Worker {worker.pid} exited")
