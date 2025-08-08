// Example local server for testing the Job Info Extractor extension
// Run with: node example-server.js

const express = require('express');
const cors = require('cors');
const app = express();

// Use environment variable for port or default to 3000
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow requests from extension
app.use(express.json());

// Store extracted jobs in memory (in production, use a database)
const extractedJobs = [];

// API endpoint for receiving job data
app.post('/api/jobs', (req, res) => {
  const { positionName, companyName, link } = req.body;
  
  // Validate required fields
  if (!positionName || !companyName || !link) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: positionName, companyName, and link'
    });
  }
  
  // Create job object with timestamp
  const job = {
    id: extractedJobs.length + 1,
    positionName,
    companyName,
    link,
    extractedAt: new Date().toISOString()
  };
  
  // Store the job
  extractedJobs.push(job);
  
  // Log to console
  console.log(`\n📋 New job extracted (#${job.id}):`);
  console.log(`   Position: ${positionName}`);
  console.log(`   Company:  ${companyName}`);
  console.log(`   Link:     ${link}`);
  console.log(`   Time:     ${job.extractedAt}`);
  
  // Send success response
  res.json({
    success: true,
    message: 'Job info saved successfully',
    data: job
  });
});

// Get all extracted jobs
app.get('/api/jobs', (req, res) => {
  res.json({
    success: true,
    count: extractedJobs.length,
    jobs: extractedJobs
  });
});

// Get a specific job by ID
app.get('/api/jobs/:id', (req, res) => {
  const jobId = parseInt(req.params.id);
  const job = extractedJobs.find(j => j.id === jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  res.json({
    success: true,
    job
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Job Info Extractor API is running',
    timestamp: new Date().toISOString(),
    totalJobs: extractedJobs.length
  });
});

// Start the server
app.listen(PORT, () => {
  console.log('🚀 Job Info Extractor API Server Started!');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 View jobs: http://localhost:${PORT}/api/jobs`);
  console.log('\n✅ Ready to receive job extractions from your browser extension!\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  console.log(`📊 Total jobs extracted this session: ${extractedJobs.length}`);
  process.exit(0);
}); 