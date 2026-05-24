#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Tarot Reading Portal - Full Stack Setup ===${NC}\n"

# Check if Docker is running
echo -e "${YELLOW}Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not installed. Please install Docker Desktop from https://www.docker.com${NC}"
    exit 1
fi

# Start PostgreSQL if not running
if ! docker ps | grep -q tarot_db; then
    echo -e "${YELLOW}Starting PostgreSQL container...${NC}"
    docker run --name tarot_db \
        -e POSTGRES_USER=tarot_user \
        -e POSTGRES_PASSWORD=tarot_password \
        -e POSTGRES_DB=tarot_db \
        -p 5432:5432 \
        -d postgres:16-alpine
    
    echo -e "${GREEN}✓ PostgreSQL started${NC}\n"
    sleep 3  # Wait for database to be ready
else
    echo -e "${GREEN}✓ PostgreSQL already running${NC}\n"
fi

# Setup Backend
echo -e "${YELLOW}Setting up Backend...${NC}"
cd server
npm install > /dev/null 2>&1
npm run prisma:generate > /dev/null 2>&1
npm run prisma:migrate -- --name init > /dev/null 2>&1
echo -e "${GREEN}✓ Backend setup complete${NC}\n"
cd ..

# Setup Frontend
echo -e "${YELLOW}Setting up Frontend...${NC}"
npm install > /dev/null 2>&1
echo -e "${GREEN}✓ Frontend setup complete${NC}\n"

# Final message
echo -e "${GREEN}=== Setup Complete! ===${NC}\n"
echo -e "${BLUE}To start developing:${NC}"
echo -e "1. In terminal 1: ${YELLOW}npm run dev${NC} (Frontend on http://localhost:5173)"
echo -e "2. In terminal 2: ${YELLOW}cd server && npm run dev${NC} (Backend on http://localhost:3000)"
echo -e "\n${BLUE}Test your setup:${NC}"
echo -e "  - Frontend: http://localhost:5173"
echo -e "  - Backend Health: http://localhost:3000/api/health"
echo -e "  - Database: ${YELLOW}cd server && npm run prisma:studio${NC}"
echo -e "\nFor more info, see ${YELLOW}FULLSTACK_SETUP.md${NC}\n"
