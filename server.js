const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Create temp directory for code execution
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
(async () => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log('Temp directory created/verified');
  } catch (error) {
    console.error('Error creating temp directory:', error);
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

// Cleanup old files (run every 5 minutes)
setInterval(async () => {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;
      
      // Delete files older than 10 minutes
      if (age > 10 * 60 * 1000) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}, 5 * 60 * 1000);

// Execute code in a safe manner
async function executeCode(language, code, input) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    throw new Error('Unsupported language');
  }

  // Generate unique ID for this execution
  const id = uuidv4();
  const workDir = path.join(TEMP_DIR, id);
  
  try {
    // Create work directory
    await fs.mkdir(workDir, { recursive: true });
    
    // Determine filename
    let filename;
    if (language === 'java') {
      // Extract class name from Java code
      const classMatch = code.match(/public\s+class\s+(\w+)/);
      filename = classMatch ? `${classMatch[1]}.${config.extension}` : `Main.${config.extension}`;
    } else {
      filename = `program.${config.extension}`;
    }
    
    const filePath = path.join(workDir, filename);
    
    // Write code to file
    await fs.writeFile(filePath, code);
    
    // Write input to file
    const inputPath = path.join(workDir, 'input.txt');
    await fs.writeFile(inputPath, input || '');
    
    const startTime = Date.now();
    
    // Compile if needed
    if (config.compile) {
      const compileCommand = config.compile(filename);
      const compileResult = await executeCommand(compileCommand, workDir, config.timeout);
      
      if (compileResult.error) {
        return {
          error: compileResult.stderr || compileResult.error,
          executionTime: Date.now() - startTime
        };
      }
    }
    
    // Run the program
    const runCommand = `${config.run(filename)} < input.txt`;
    const runResult = await executeCommand(runCommand, workDir, config.timeout);
    
    const executionTime = Date.now() - startTime;
    
    // Clean up
    await cleanupDirectory(workDir);
    
    return {
      output: runResult.stdout,
      stderr: runResult.stderr,
      error: runResult.error,
      executionTime
    };
    
  } catch (error) {
    // Clean up on error
    try {
      await cleanupDirectory(workDir);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    throw error;
  }
}

// Execute a command with timeout
function executeCommand(command, cwd, timeout) {
  return new Promise((resolve) => {
    const process = exec(
      command,
      {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        killSignal: 'SIGTERM'
      },
      (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            resolve({
              error: 'Execution timed out. Your program took too long to execute.',
              stdout: stdout,
              stderr: stderr
            });
          } else {
            resolve({
              error: error.message,
              stdout: stdout,
              stderr: stderr
            });
          }
        } else {
          resolve({
            stdout: stdout,
            stderr: stderr,
            error: null
          });
        }
      }
    );
  });
}

// Clean up directory
async function cleanupDirectory(dir) {
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      await fs.unlink(path.join(dir, file));
    }
    await fs.rmdir(dir);
  } catch (error) {
    console.error('Error cleaning up directory:', error);
  }
}

// API endpoint to execute code
app.post('/execute', async (req, res) => {
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
        error: `Unsupported language: ${language}`
      });
    }
    
    // Code length limit (1MB)
    if (code.length > 1024 * 1024) {
      return res.status(400).json({
        error: 'Code size exceeds limit (1MB)'
      });
    }
    
    console.log(`Executing ${language} code...`);
    
    // Execute the code
    const result = await executeCode(language, code, input || '');
    
    res.json(result);
    
  } catch (error) {
    console.error('Execution error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    supportedLanguages: Object.keys(LANGUAGE_CONFIG),
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Code execution server running on port ${PORT}`);
  console.log(`📝 Supported languages: ${Object.keys(LANGUAGE_CONFIG).join(', ')}`);
  console.log(`📂 Temp directory: ${TEMP_DIR}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, cleaning up...');
  try {
    await cleanupDirectory(TEMP_DIR);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  process.exit(0);
});
