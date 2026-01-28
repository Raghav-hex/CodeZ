# CODEX - Online Code Compiler

A full-featured, cross-platform online compiler that runs in any modern browser. Supports C++, Java, Python, and JavaScript with secure sandboxed execution.

![CODEX Online Compiler](https://img.shields.io/badge/CODEX-Online%20Compiler-00d9ff?style=for-the-badge)

## 🚀 Features

- **Multi-Language Support**: C++, Java, Python, JavaScript
- **Monaco Editor**: VS Code's editor with syntax highlighting
- **Secure Execution**: Sandboxed code execution with timeouts
- **Modern UI**: Beautiful, responsive interface with dark/light themes
- **Real-time Compilation**: Instant feedback with execution time
- **Input/Output**: Support for stdin input and stdout/stderr output
- **Cross-Platform**: Works on any modern browser
- **Docker-Ready**: Easy deployment with Docker Compose

## 📋 Prerequisites

### Option 1: Local Development
- Node.js 18+ and npm
- C++ compiler (g++)
- Java JDK 11+
- Python 3.x

### Option 2: Docker Deployment (Recommended)
- Docker
- Docker Compose

## 🛠️ Installation & Setup

### Option 1: Local Development

1. **Clone or download the project files**

2. **Install backend dependencies**
```bash
npm install
```

3. **Start the backend server**
```bash
npm start
```
The server will run on http://localhost:3001

4. **Open the frontend**
Simply open `index.html` in your browser, or use a local server:
```bash
# Using Python
python3 -m http.server 8080

# Using Node.js http-server
npx http-server -p 8080
```
Then visit http://localhost:8080

### Option 2: Docker Deployment (Recommended)

1. **Build and start services**
```bash
docker-compose up -d
```

2. **Access the application**
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001

3. **Stop services**
```bash
docker-compose down
```

## 📁 Project Structure

```
codex-compiler/
├── index.html              # Frontend HTML with React
├── compiler-frontend.jsx   # React component (for reference)
├── server.js               # Backend Express server
├── package.json            # Node.js dependencies
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Multi-container setup
├── README.md               # This file
└── temp/                   # Temporary execution directory
```

## 🔒 Security Features

- **Execution Timeout**: Programs are terminated after 10 seconds
- **File Isolation**: Each execution gets a unique temporary directory
- **Automatic Cleanup**: Old files are removed every 5 minutes
- **Code Size Limits**: Maximum 1MB per submission
- **Sandboxed Environment**: Docker containers isolate execution
- **No Network Access**: Executed code cannot access external networks

## 💻 Supported Languages

### C++
- Compiler: g++
- Standard: C++17
- Example:
```cpp
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}
```

### Java
- Version: OpenJDK 11
- Main class: Auto-detected or `Main`
- Example:
```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

### Python
- Version: Python 3.x
- Example:
```python
print("Hello, World!")
```

### JavaScript
- Runtime: Node.js 18+
- Example:
```javascript
console.log("Hello, World!");
```

## 🌐 API Documentation

### Execute Code
**Endpoint:** `POST /execute`

**Request Body:**
```json
{
  "language": "python",
  "code": "print('Hello, World!')",
  "input": ""
}
```

**Response:**
```json
{
  "output": "Hello, World!\n",
  "stderr": "",
  "error": null,
  "executionTime": 45
}
```

### Health Check
**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "supportedLanguages": ["cpp", "java", "python", "javascript"],
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

## 🎨 UI Features

- **Theme Toggle**: Switch between dark and light modes
- **Syntax Highlighting**: Monaco Editor with language-specific highlighting
- **Auto-completion**: IntelliSense-like features
- **Line Numbers**: Easy code navigation
- **Window Controls**: macOS-style window decoration
- **Responsive Design**: Works on desktop and tablet devices

## 🔧 Configuration

### Backend Configuration
Edit `server.js` to modify:
- Port number (default: 3001)
- Timeout duration (default: 10 seconds)
- Code size limit (default: 1MB)
- Cleanup interval (default: 5 minutes)

### Frontend Configuration
Edit `index.html` or `compiler-frontend.jsx` to modify:
- API URL (default: http://localhost:3001)
- Default language
- Editor theme
- UI colors and styling

## 📊 Performance

- **Execution Time**: Most programs complete in < 100ms
- **Memory Usage**: Isolated per execution
- **Concurrent Executions**: Supports multiple simultaneous requests
- **Cleanup**: Automatic resource management

## 🐛 Troubleshooting

### "Network Error" in Output
- Ensure the backend server is running on port 3001
- Check if the API_URL in `index.html` is correct
- Verify CORS is enabled on the backend

### Compilation Errors
- Check language syntax is correct
- Ensure required compilers are installed
- Review stderr output for detailed error messages

### Docker Issues
- Ensure Docker daemon is running
- Check port 3001 and 8080 are not in use
- Verify Docker Compose version compatibility

## 🚀 Deployment

### Production Deployment

1. **Set environment variables**
```bash
export NODE_ENV=production
```

2. **Use a process manager**
```bash
npm install -g pm2
pm2 start server.js --name codex-backend
```

3. **Set up reverse proxy** (nginx example)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/frontend;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Cloud Deployment Options
- **AWS**: EC2 with Docker or ECS
- **Google Cloud**: Cloud Run or Compute Engine
- **DigitalOcean**: Droplet with Docker
- **Heroku**: Container deployment
- **Azure**: Container Instances

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Add more programming languages
- Implement file upload/download
- Add code sharing features
- Improve error messages
- Add user authentication
- Implement code snippets library

## 📝 License

MIT License - Feel free to use this project for learning or commercial purposes.

## 🔮 Future Enhancements

- [ ] More languages (Go, Rust, Ruby, etc.)
- [ ] Multiple file support
- [ ] Code collaboration features
- [ ] Syntax error highlighting
- [ ] Code formatting tools
- [ ] Performance benchmarking
- [ ] Database integration for code saving
- [ ] User accounts and profiles
- [ ] Code sharing via links
- [ ] Mobile app versions

## 📞 Support

For issues or questions:
- Check the troubleshooting section
- Review server logs for backend issues
- Check browser console for frontend issues
- Verify all dependencies are installed

## 🎓 Learning Resources

- [Monaco Editor Documentation](https://microsoft.github.io/monaco-editor/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev/)
- [Docker Documentation](https://docs.docker.com/)

---

**Built with ❤️ using React, Express, Monaco Editor, and Docker**
