#!/bin/bash

echo "🚀 CODEX Online Compiler - Quick Start"
echo "======================================"
echo ""

# Check if Docker is installed
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "✅ Docker detected"
    echo ""
    echo "Starting with Docker Compose..."
    echo ""
    
    docker-compose up -d
    
    echo ""
    echo "✅ Services started!"
    echo ""
    echo "📝 Frontend: http://localhost:8080"
    echo "🔧 Backend API: http://localhost:3001"
    echo ""
    echo "To stop: docker-compose down"
    
elif command -v node &> /dev/null; then
    echo "✅ Node.js detected"
    echo ""
    echo "Installing dependencies..."
    npm install
    
    echo ""
    echo "Starting backend server..."
    npm start &
    
    echo ""
    echo "✅ Backend started on port 3001"
    echo ""
    echo "📝 Open index.html in your browser or run:"
    echo "   python3 -m http.server 8080"
    echo "   or"
    echo "   npx http-server -p 8080"
    echo ""
    
else
    echo "❌ Neither Docker nor Node.js found"
    echo ""
    echo "Please install one of the following:"
    echo "  - Docker & Docker Compose (recommended)"
    echo "  - Node.js 18+ with npm"
    echo ""
    echo "Then run this script again."
fi
