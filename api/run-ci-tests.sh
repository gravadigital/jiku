#!/bin/bash
# =============================================================================
# Simular flujo CI localmente
# =============================================================================

set -e

IMAGE_NAME="grava-gestor-api:test"
DB_CONTAINER_NAME="database"

echo "Building test image..."
docker build -t $IMAGE_NAME .

echo "Starting PostgreSQL container..."
docker run -e POSTGRES_USER=test -e POSTGRES_DB=gestionTest -e POSTGRES_PASSWORD=testing --name $DB_CONTAINER_NAME -d postgres:15.4-alpine3.18

cleanup() {
  echo "Cleaning up..."
  docker stop $DB_CONTAINER_NAME 2>/dev/null || true
  docker rm $DB_CONTAINER_NAME 2>/dev/null || true
}
trap cleanup EXIT

echo "Running tests..."
docker run --rm --link $DB_CONTAINER_NAME:database -e CI=true $IMAGE_NAME npm run test:coverage

echo "Tests completed successfully"
