#!/bin/bash

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colorful status messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start from a clean slate if containers exist
log_info "Checking for existing containers..."
if [ "$(docker ps -aq -f name=postgres)" ]; then
    log_warn "Existing postgres container found. Stopping and removing..."
    docker stop $(docker ps -aq -f name=postgres) > /dev/null
    docker rm $(docker ps -aq -f name=postgres) > /dev/null
fi

# Start PostgreSQL container
log_info "Starting PostgreSQL container..."
docker-compose up -d

# Wait for PostgreSQL to be ready
log_info "Waiting for PostgreSQL to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
until docker exec $(docker ps -q -f name=postgres) pg_isready -U postgres -d mydb > /dev/null 2>&1 || [ $ATTEMPT -eq $MAX_ATTEMPTS ]; do
    log_info "Waiting for database connection... ($ATTEMPT/$MAX_ATTEMPTS)"
    ATTEMPT=$((ATTEMPT+1))
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    log_error "Database failed to start in a reasonable time. Please check the logs with 'docker logs $(docker ps -q -f name=postgres)'"
    exit 1
fi

log_info "PostgreSQL is ready!"

# Install pgvector extension
log_info "Installing pgvector extension (this may take a few minutes)..."
docker exec -it $(docker ps -q -f name=postgres) bash -c "
    apt-get update > /dev/null &&
    apt-get install -y postgresql-server-dev-15 make gcc git > /dev/null &&
    git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git > /dev/null &&
    cd pgvector &&
    make > /dev/null &&
    make install > /dev/null
" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    log_error "Failed to install pgvector extension. Please check the container logs."
    exit 1
fi

# Enable pgvector extension in the database
log_info "Enabling pgvector extension..."
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d mydb -c "CREATE EXTENSION IF NOT EXISTS vector;" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    log_error "Failed to enable pgvector extension. Please check the container logs."
    exit 1
fi

# Run migrations
log_info "Running database migrations..."
npx tsx sequential-migrate.ts

if [ $? -ne 0 ]; then
    log_error "Failed to run migrations. Please check the error above."
    exit 1
fi

# Run database seeding
# Assuming you have a seed.sql file or similar
log_info "Seeding the database..."
# Uncomment and modify one of these options based on your seed data format:

docker exec -i $(docker ps -q -f name=postgres) psql -U postgres -d mydb < ./seed.sql

# Display connection information
log_info "Database setup complete! 🎉"
log_info "Connection details:"
log_info "  Host: localhost"
log_info "  Port: 5433"
log_info "  User: postgres"
log_info "  Password: postgres"
log_info "  Database: mydb"
log_info ""
log_info "Connect with: psql -h localhost -p 5433 -U postgres -d mydb"