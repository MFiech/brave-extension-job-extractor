// Configuration file for the Job Info Extractor extension
// This file handles default configurations and environment variables

// Default configuration values
const DEFAULT_CONFIG = {
  // These can be overridden by user input in the extension popup
  defaultWebhookUrl: 'http://localhost:3000/api/jobs',
  defaultOpenAIModel: 'gpt-4o-mini',
  
  // OpenAI API settings
  openaiApiUrl: 'https://api.openai.com/v1/chat/completions',
  maxTokens: 500,
  temperature: 0.1,
  
  // Content extraction settings
  maxTextLength: 12000,
  pageLoadDelay: 8000,
  maxRetries: 2
};

// Function to get configuration with fallbacks
function getConfig() {
  return DEFAULT_CONFIG;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_CONFIG, getConfig };
}
