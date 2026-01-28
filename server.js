const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001; // Render uses dynamic PORT

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Create temp directory for code execution
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
(async () => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log('✅ Temp directory created/verified');
  } catch (error) {
    console.error('❌ Error creating temp directory:', error);
  }
})();

// Language configurations
const LANGUAGE_CONFIG = {
  cpp: {
    extension: 'cpp',
    compile: (filename) => `g++ -o ${filename.replace('.cpp', '')} ${filename} -std=c++17`,
    run: (filename) => `./${filename.replace('.cpp', '')}`,
    timeout: 10000
  },
  java: {
    extension: 'java',
    compile: (filename) => `javac ${filename}`,
    run: (filename) => `java ${filename.replace('.java', '')}`,
    timeout: 10000
  },
  python: {
    extension: 'py',
    compile: null,
    run: (filename) => `python3 ${filename}`,
    timeout: 10000
  },
  javascript: {
    extension: 'js',
    compile: null,
    run: (filename) => `node ${filename}`,
    timeout: 10000
  }
};

// Cleanup old files
setInterval(async () => {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > 10 * 60 * 1000) {
          await fs.unlink(filePath);
          console.log(`🧹 Cleaned: ${file}`);
        }
      } catch (err) {}
    }
  } catch (error) {}
}, 5 * 60 * 1000);

// Execute code
async function executeCode(language, code, input) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) throw new Error('Unsupported language');

  const id = uuidv4();
  const workDir = path.join(TEMP_DIR, id);
  
  try {
    await fs.mkdir(workDir, { recursive: true });
    
    let filename;
    if (language === 'java') {
      const classMatch = code.match(/public\s+class\s+(\w+)/);
      filename = classMatch ? `${classMatch[1]}.${config.extension}` : `Main.${config.extension}`;
    } else {
      filename = `program.${config.extension}`;
    }
    
    const filePath = path.join(workDir, filename);
    await fs.writeFile(filePath, code);
    
    const inputPath = path.join(workDir, 'input.txt');
    await fs.writeFile(inputPath, input || '');
    
    const startTime = Date.now();
    
    if (config.compile) {
      const compileResult = await executeCommand(config.compile(filename), workDir, config.timeout);
      if (compileResult.error) {
        return {
          error: compileResult.stderr || compileResult.error,
          executionTime: Date.now() - startTime
        };
      }
    }
    
    const runCommand = `${config.run(filename)} < input.txt`;
    const runResult = await executeCommand(runCommand, workDir, config.timeout);
    const executionTime = Date.now() - startTime;
    
    await cleanupDirectory(workDir);
    
    return {
      output: runResult.stdout,
      stderr: runResult.stderr,
      error: runResult.error,
      executionTime
    };
  } catch (error) {
    try { await cleanupDirectory(workDir); } catch (e) {}
    throw error;
  }
}

function executeCommand(command, cwd, timeout) {
  return new Promise((resolve) => {
    const process = exec(command, { cwd, timeout, maxBuffer: 10485760, killSignal: 'SIGTERM' },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            error: error.killed ? 'Execution timed out' : error.message,
            stdout, stderr
          });
        } else {
          resolve({ stdout, stderr, error: null });
        }
      }
    );
  });
}

async function cleanupDirectory(dir) {
  try {
    const files = await fs.readdir(dir);
    for (const file of files) await fs.unlink(path.join(dir, file));
    await fs.rmdir(dir);
  } catch (error) {}
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: '🚀 CODEX Compiler API',
    status: 'running',
    endpoints: { execute: 'POST /execute', health: 'GET /health' },
    supportedLanguages: Object.keys(LANGUAGE_CONFIG)
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    supportedLanguages: Object.keys(LANGUAGE_CONFIG)
  });
});

app.post('/execute', async (req, res) => {
  try {
    const { language, code, input } = req.body;
    
    if (!language || !code) {
      return res.status(400).json({ error: 'Missing required fields: language and code' });
    }
    
    if (!LANGUAGE_CONFIG[language]) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }
    
    if (code.length > 1048576) {
      return res.status(400).json({ error: 'Code size exceeds limit (1MB)' });
    }
    
    console.log(`⚡ Executing ${language} code...`);
    const result = await executeCode(language, code, input || '');
    res.json(result);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 CODEZ Compiler running on port ${PORT}`);
  console.log(`📝 Languages: ${Object.keys(LANGUAGE_CONFIG).join(', ')}\n`);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});
