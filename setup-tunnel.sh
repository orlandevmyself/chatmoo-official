#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ChatMoo Tunnel Setup ===${NC}\n"

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}ngrok is not installed${NC}"
    echo "Install ngrok from: https://ngrok.com/download"
    echo "Then run: brew install ngrok (macOS) or download from website"
    exit 1
fi

# Check for ngrok auth token
if ! ngrok config check &> /dev/null; then
    echo -e "${YELLOW}ngrok not authenticated${NC}"
    echo "Run: ngrok config add-authtoken YOUR_AUTH_TOKEN"
    echo "Get token from: https://dashboard.ngrok.com/auth"
    exit 1
fi

echo -e "${GREEN}✓ ngrok is installed and authenticated${NC}\n"

# Create ngrok config file if it doesn't exist
NGROK_CONFIG="$HOME/.ngrok2/ngrok-chatmoo.yml"
cat > "$NGROK_CONFIG" << 'EOF'
version: "3"
sessions:
  - name: chatmoo-tunnel
    authtoken: ${NGROK_AUTHTOKEN}

tunnels:
  backend:
    proto: http
    addr: 3000
    host_header: rewrite

  frontend:
    proto: http
    addr: 3001
    host_header: rewrite

  admin:
    proto: http
    addr: 3002
    host_header: rewrite
EOF

echo -e "${GREEN}✓ Created ngrok config${NC}\n"

# Display instructions
echo -e "${BLUE}=== Starting Services ===${NC}\n"
echo -e "${YELLOW}Open 4 terminal windows and run:${NC}\n"

echo -e "${BLUE}Terminal 1 - Backend${NC}"
echo -e "cd backend && npm run start\n"

echo -e "${BLUE}Terminal 2 - Frontend${NC}"
echo -e "cd frontend && npm start\n"

echo -e "${BLUE}Terminal 3 - Admin${NC}"
echo -e "cd admin && npm start\n"

echo -e "${BLUE}Terminal 4 - ngrok Tunnel${NC}"
echo -e "ngrok start --config=$NGROK_CONFIG --all\n"

echo -e "${GREEN}=== Service URLs ===${NC}"
echo -e "Backend:  http://localhost:3000"
echo -e "Frontend: http://localhost:3001"
echo -e "Admin:    http://localhost:3002\n"

echo -e "${YELLOW}After ngrok starts, you'll see tunnel URLs like:${NC}"
echo -e "Backend:  https://xxxx-xx-xxx-xx.ngrok.io"
echo -e "Frontend: https://xxxx-xx-xxx-xx.ngrok.io"
echo -e "Admin:    https://xxxx-xx-xxx-xx.ngrok.io\n"

echo -e "${BLUE}=== Quick Start ===${NC}"
echo -e "1. Copy the ngrok frontend URL"
echo -e "2. Visit it in your browser"
echo -e "3. Test signup, login, premium features, etc."
echo -e "4. Admin panel: https://xxxx-xx-xxx-xx.ngrok.io (admin port)\n"

echo -e "${GREEN}Ready to start? Run services in separate terminals!${NC}"
