const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Create temp directory
const TEMP_DIR = path.join(__dirname, 'temp');

// Language configurations with security constraints
const LANGUAGE_CONFIG = {
  cpp: {
    extension: 'cpp',
    compile: {
      command: 'g++',
      args: (filepath, outputPath) => [
        filepath,
        '-o', outputPath,
        '-std=c++17',
        '-Wall',
        '-O2'
      ]
    },
    run: {
      command: (execPath) => execPath,
      args: []
    },
    timeout: 10000,
    memoryLimit: 256 // MB
  },
  java: {
    extension: 'java',
    compile: {
      command: 'javac',
      args: (filepath) => [filepath]
    },
    run: {
      command: 'java',
      args: (className) => ['-Xmx256m', className]
    },
    timeout: 10000,
    memoryLimit: 256
  },
  python: {
    extension: 'py',
    compile: null,
    run: {
      command: 'python3',
      args: (filepath) => ['-u', filepath]
    },
    timeout: 10000,
    memoryLimit: 256
  },
  javascript: {
    extension: 'js',
    compile: null,
    run: {
      command: 'node',
      args: (filepath) => ['--max-old-space-size=256', filepath]
    },
    timeout: 10000,
    memoryLimit: 256
  }
};

// Initialize
(async () => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log('✅ Temp directory initialized');
  } catch (error) {
    console.error('❌ Error creating temp directory:', error);
  }
})();

// Cleanup function
async function cleanupWorkDir(workDir) {
  try {
    const files = await fs.readdir(workDir);
    await Promise.all(files.map(file => fs.unlink(path.join(workDir, file))));
    await fs.rmdir(workDir);
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}

// Periodic cleanup (every 5 minutes)
setInterval(async () => {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory() && (now - stats.mtimeMs) > 10 * 60 * 1000) {
          await cleanupWorkDir(filePath);
          console.log(`🧹 Cleaned up: ${file}`);
        }
      } catch (err) {
        // File might have been deleted already
      }
    }
  } catch (error) {
    console.error('Periodic cleanup error:', error);
  }
}, 5 * 60 * 1000);

// Execute command with timeout and limits
function executeProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      cwd,
      input = '',
      timeout = 10000,
      memoryLimit = 256
    } = options;

    let stdout = '';
    let stderr = '';
    let killed = false;

    const process = spawn(command, args, {
      cwd,
      timeout,
      env: {
        ...process.env,
        HOME: cwd,
        PATH: process.env.PATH
      }
    });

    // Timeout handler
    const timeoutId = setTimeout(() => {
      killed = true;
      process.kill('SIGTERM');
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 1000);
    }, timeout);

    // Data handlers
    process.stdout.on('data', (data) => {
      stdout += data.toString();
      // Limit output size
      if (stdout.length > 1024 * 1024) {
        killed = true;
        process.kill('SIGTERM');
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 1024 * 1024) {
        killed = true;
        process.kill('SIGTERM');
      }
    });

    // Error handler
    process.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    // Exit handler
    process.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (killed) {
        resolve({
          stdout,
          stderr,
          exitCode: -1,
          error: 'Process terminated: execution timeout or output limit exceeded'
        });
      } else {
        resolve({
          stdout,
          stderr,
          exitCode: code,
          error: code !== 0 ? `Process exited with code ${code}` : null
        });
      }
    });

    // Send input if provided
    if (input) {
      process.stdin.write(input);
      process.stdin.end();
    }
  });
}

// Main execution function
async function executeCode(language, code, input) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const id = uuidv4();
  const workDir = path.join(TEMP_DIR, id);
  
  try {
    // Create work directory
    await fs.mkdir(workDir, { recursive: true });
    
    // Determine filename
    let filename;
    if (language === 'java') {
      const classMatch = code.match(/public\s+class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : 'Main';
      filename = `${className}.${config.extension}`;
    } else {
      filename = `program.${config.extension}`;
    }
    
    const filepath = path.join(workDir, filename);
    await fs.writeFile(filepath, code);
    
    const startTime = Date.now();
    
    // Compile if needed
    if (config.compile) {
      const outputPath = language === 'cpp' 
        ? path.join(workDir, 'program')
        : null;
      
      const compileArgs = language === 'cpp'
        ? config.compile.args(filepath, outputPath)
        : config.compile.args(filepath);
      
      const compileResult = await executeProcess(
        config.compile.command,
        compileArgs,
        {
          cwd: workDir,
          timeout: config.timeout
        }
      );
      
      if (compileResult.exitCode !== 0) {
        await cleanupWorkDir(workDir);
        return {
          error: 'Compilation failed',
          stderr: compileResult.stderr,
          output: compileResult.stdout,
          executionTime: Date.now() - startTime
        };
      }
    }
    
    // Run the program
    let runCommand, runArgs;
    
    if (language === 'cpp') {
      runCommand = path.join(workDir, 'program');
      runArgs = config.run.args;
    } else if (language === 'java') {
      const classMatch = code.match(/public\s+class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : 'Main';
      runCommand = config.run.command;
      runArgs = config.run.args(className);
    } else {
      runCommand = config.run.command;
      runArgs = config.run.args(filepath);
    }
    
    const runResult = await executeProcess(
      runCommand,
      runArgs,
      {
        cwd: workDir,
        input,
        timeout: config.timeout,
        memoryLimit: config.memoryLimit
      }
    );
    
    const executionTime = Date.now() - startTime;
    
    // Cleanup
    await cleanupWorkDir(workDir);
    
    return {
      output: runResult.stdout,
      stderr: runResult.stderr,
      error: runResult.error,
      executionTime,
      exitCode: runResult.exitCode
    };
    
  } catch (error) {
    await cleanupWorkDir(workDir).catch(() => {});
    throw error;
  }
}

// API Routes

// Execute code endpoint
app.post('/execute', async (req, res) => {
  const requestStart = Date.now();
  
  try {
    const { language, code, input } = req.body;
    
    // Validation
    if (!language || !code) {
      return res.status(400).json({
        error: 'Missing required fields: language and code'
      });
    }
    
    if (!LANGUAGE_CONFIG[language]) {
      return res.status(400).json({
        error: `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_CONFIG).join(', ')}`
      });
    }
    
    if (code.length > 1024 * 1024) {
      return res.status(400).json({
        error: 'Code size exceeds limit (1MB)'
      });
    }
    
    if (input && input.length > 1024 * 1024) {
      return res.status(400).json({
        error: 'Input size exceeds limit (1MB)'
      });
    }
    
    console.log(`⚡ Executing ${language} code (${code.length} bytes)`);
    
    // Execute
    const result = await executeCode(language, code, input || '');
    
    const totalTime = Date.now() - requestStart;
    console.log(`✅ Completed in ${totalTime}ms`);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Execution error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    supportedLanguages: Object.keys(LANGUAGE_CONFIG),
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'POST /execute',
      'GET /health'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   CODEX Online Compiler - Backend       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Supported languages: ${Object.keys(LANGUAGE_CONFIG).join(', ')}`);
  console.log(`📂 Temp directory: ${TEMP_DIR}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST http://localhost:${PORT}/execute`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('');
  console.log('🛑 Shutting down gracefully...');
  
  server.close(async () => {
    console.log('✅ Server closed');
    
    try {
      const files = await fs.readdir(TEMP_DIR);
      for (const file of files) {
        const filePath = path.join(TEMP_DIR, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          await cleanupWorkDir(filePath);
        }
      }
      console.log('✅ Cleanup complete');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    
    process.exit(0);
  });
}
