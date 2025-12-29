# ============================================
# MOJO Messaging - Makefile
# ============================================

.PHONY: help install dev prod down logs migrate seed studio build test clean network

# Default target
help:
	@echo "MOJO Messaging - Available Commands"
	@echo "===================================="
	@echo ""
	@echo "Development:"
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Start development environment"
	@echo "  make dev-bg     - Start development in background"
	@echo "  make logs       - Show logs"
	@echo "  make logs-api   - Show API logs only"
	@echo ""
	@echo "Production:"
	@echo "  make prod       - Start production environment"
	@echo "  make down       - Stop all containers"
	@echo "  make restart    - Restart all containers"
	@echo ""
	@echo "Database:"
	@echo "  make migrate    - Run database migrations"
	@echo "  make seed       - Seed database with default data"
	@echo "  make studio     - Open Prisma Studio"
	@echo "  make generate   - Generate Prisma Client"
	@echo ""
	@echo "Build:"
	@echo "  make build      - Build Docker images"
	@echo "  make build-api  - Build API only"
	@echo ""
	@echo "Other:"
	@echo "  make test       - Run tests"
	@echo "  make clean      - Remove containers and volumes"
	@echo "  make network    - Create Docker network"
	@echo "  make health     - Check service health"

# ============================================
# Development
# ============================================

install:
	@echo "📦 Installing dependencies..."
	cd apps/api && npm install

dev:
	@echo "🚀 Starting development environment..."
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

dev-bg:
	@echo "🚀 Starting development environment (background)..."
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

# ============================================
# Production
# ============================================

prod:
	@echo "🚀 Starting production environment..."
	docker compose up -d

down:
	@echo "📴 Stopping containers..."
	docker compose down

restart:
	@echo "🔄 Restarting containers..."
	docker compose restart

# ============================================
# Database
# ============================================

migrate:
	@echo "📊 Running database migrations..."
	docker compose exec api npx prisma migrate deploy

migrate-dev:
	@echo "📊 Running development migrations..."
	docker compose exec api npx prisma migrate dev

seed:
	@echo "🌱 Seeding database..."
	docker compose exec api npx prisma db seed

studio:
	@echo "🎨 Opening Prisma Studio..."
	cd apps/api && npx prisma studio

generate:
	@echo "⚙️ Generating Prisma Client..."
	cd apps/api && npx prisma generate

# ============================================
# Build
# ============================================

build:
	@echo "🔨 Building Docker images..."
	docker compose build

build-api:
	@echo "🔨 Building API image..."
	docker compose build api

# ============================================
# Testing
# ============================================

test:
	@echo "🧪 Running tests..."
	cd apps/api && npm test

# ============================================
# Cleanup
# ============================================

clean:
	@echo "🧹 Cleaning up..."
	docker compose down -v --remove-orphans
	rm -rf apps/api/node_modules
	rm -rf apps/api/dist

# ============================================
# Network
# ============================================

network:
	@echo "🌐 Creating Docker network..."
	docker network create mojo-network 2>/dev/null || true

traefik-connect:
	@echo "🔗 Connecting Traefik to network..."
	docker network connect mojo-network traefik 2>/dev/null || true

# ============================================
# Health Check
# ============================================

health:
	@echo "🏥 Checking service health..."
	@curl -s http://localhost:3020/api/v1/health/detailed | python3 -m json.tool 2>/dev/null || echo "Service not running"

status:
	@echo "📊 Container status:"
	docker compose ps


