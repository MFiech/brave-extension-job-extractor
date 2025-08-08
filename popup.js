// Popup script for the Job Info Extractor extension

document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const debugBtn = document.getElementById('debugBtn');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const statusDiv = document.getElementById('status');
  const debugPanel = document.getElementById('debugPanel');
  const debugLogs = document.getElementById('debugLogs');
  const openaiKeyInput = document.getElementById('openaiKey');
  const localApiUrlInput = document.getElementById('localApiUrl');
  
  // Debug logging system
  function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    let logEntry = `[${timestamp}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        logEntry += '\n' + JSON.stringify(data, null, 2);
      } else {
        logEntry += '\n' + data;
      }
    }
    
    console.log(logEntry);
    debugLogs.textContent += logEntry + '\n\n';
    debugLogs.scrollTop = debugLogs.scrollHeight;
  }
  
  // Load saved settings and apply defaults
  loadSettings();
  
  extractBtn.addEventListener('click', handleExtractClick);
  debugBtn.addEventListener('click', () => {
    debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
    debugBtn.textContent = debugPanel.style.display === 'none' ? 'Show Debug Logs' : 'Hide Debug Logs';
  });
  clearLogsBtn.addEventListener('click', () => {
    debugLogs.textContent = '';
    debugLog('Debug logs cleared');
  });
  
  // Save settings when they change
  openaiKeyInput.addEventListener('blur', saveSettings);
  localApiUrlInput.addEventListener('blur', saveSettings);
  
  async function handleExtractClick() {
    try {
      // Disable button and show loading
      extractBtn.disabled = true;
      showStatus('Extracting page content...', 'loading');
      debugLog('=== EXTRACTION STARTED ===');
      
      // Get current tab and extract page text
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      debugLog('Current tab info:', {
        url: tab.url,
        title: tab.title,
        id: tab.id
      });
      
      // Check if we can access the tab
      if (!tab || !tab.id) {
        throw new Error('No active tab found');
      }
      
      // Inject content script if needed - ensure main frame injection
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false }, // Only main frame
          files: ['content.js']
        });
        debugLog('Content script injected successfully into main frame');
      } catch (injectionError) {
        // Content script might already be injected, continue
        debugLog('Content script injection result:', injectionError.message);
      }
      
      // Also try to inject into any iframes on the page
      try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
        debugLog('Found frames:', frames?.length || 0);
        
        for (const frame of frames || []) {
          if (frame.frameId !== 0) { // Not the main frame
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id, frameIds: [frame.frameId] },
                files: ['content.js']
              });
              debugLog('Content script injected into frame:', frame.url);
            } catch (frameError) {
              debugLog('Failed to inject into frame:', frame.url, frameError.message);
            }
          }
        }
      } catch (frameNavigationError) {
        debugLog('Frame navigation not available:', frameNavigationError.message);
      }
      
      // Wait a bit for content script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      debugLog('Content script initialization wait complete');
      
      let response = await extractWithRetry(tab.id, 2);
      
      // If we got very little content, try extracting from main frame only
      if (response && response.text && response.text.length < 500) {
        debugLog('Content seems too short, trying main frame extraction only...');
        try {
          // Send message specifically to the main frame (frameId: 0)
          const mainFrameResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'extractPageText',
            mainFrameOnly: true
          }, { frameId: 0 });
          debugLog('Main frame extraction response:', {
            success: mainFrameResponse?.success,
            textLength: mainFrameResponse?.text?.length || 0,
            url: mainFrameResponse?.url,
            domain: mainFrameResponse?.metadata?.domain
          });
          
          if (mainFrameResponse && mainFrameResponse.success && mainFrameResponse.text.length > response.text.length) {
            debugLog('Main frame extraction yielded more content, using that instead');
            response = mainFrameResponse;
          } else {
            debugLog('Main frame extraction did not yield better content, keeping original');
          }
        } catch (mainFrameError) {
          debugLog('Main frame extraction failed:', mainFrameError.message);
        }
      }
      
      debugLog('Page content extracted:', {
        textLength: response.text?.length || 0,
        url: response.url,
        metadata: response.metadata,
        textPreview: response.text?.substring(0, 500) + '...'
      });
      
      // Log more of the extracted content to see what we're missing
      debugLog('Full extracted content (first 2000 chars):', response.text?.substring(0, 2000));
      
      showStatus('Analyzing with OpenAI GPT-4o-mini...', 'loading');
      debugLog('Sending to OpenAI for analysis...');
      
      // Call OpenAI API to extract job info
      const jobInfo = await extractJobInfoWithOpenAI(response.text);
      
      debugLog('OpenAI response received:', jobInfo);
      
      showStatus('Sending to webhook...', 'loading');
      
      const webhookData = [{
        "Position Name": jobInfo["Position Name"],
        "Company Name": jobInfo["Company Name"], 
        "Accessible Link": jobInfo["Accessible Link"],
        "Work Model": jobInfo["Work Model"],
        "Job Location": jobInfo["Job Location"],
        "comment": jobInfo["comment"]
      }];
      
      debugLog('Webhook payload:', webhookData);
      
      // Send to webhook
      await sendToWebhook(webhookData);
      
      debugLog('Webhook sent successfully');
      showStatus(`Successfully extracted: ${jobInfo["Position Name"]} at ${jobInfo["Company Name"]}`, 'success');
      debugLog('=== EXTRACTION COMPLETED ===');
      
    } catch (error) {
      console.error('Extension error:', error);
      debugLog('ERROR occurred:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      extractBtn.disabled = false;
    }
  }
  
  async function extractWithRetry(tabId, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          showStatus(`Retrying extraction (attempt ${attempt}/${maxRetries})...`, 'loading');
          // Add extra delay for retries to let more content load
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          showStatus('Extracting page content...', 'loading');
        }
        
        const response = await chrome.tabs.sendMessage(tabId, {action: 'extractPageText'});
        
        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to extract page text');
        }
        
        // Always return the response - let OpenAI handle content qualification
        return response;
        
      } catch (connectionError) {
        console.log(`Connection attempt ${attempt} failed:`, connectionError.message);
        
        if (attempt === maxRetries) {
          // Check if this is a restricted page
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('brave://') || tab.url.startsWith('moz-extension://')) {
            throw new Error('Cannot access browser internal pages. Please navigate to a job listing website.');
          }
          throw new Error('Cannot access this page. Try refreshing the page and try again.');
        }
        
        // Wait before retry for connection issues only
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  async function extractJobInfoWithOpenAI(pageText) {
    const apiKey = openaiKeyInput.value.trim();
    if (!apiKey) {
      throw new Error('Please enter your OpenAI API key');
    }
    
    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert job posting analyzer. Extract comprehensive job information from web page content.

EXTRACTION PRIORITY:
1. Look for site-specific data first (GREENHOUSE_JOB_TITLE, LINKEDIN_JOB_TITLE, etc.)
2. Check H1_HEADING tags and PAGE_TITLE for job titles
3. Find company names in COMPANY_LINK entries, domain info, or headers
4. Extract location and work model from job description content
5. Analyze iframe content if present (IFRAME_X_CONTENT sections)

FIELD EXTRACTION RULES:
- Position Name: Keep seniority levels (Senior, Lead, etc.), remove location/employment type
- Company Name: Use full company names, avoid domain-only names when possible
- Job Location: Extract specific city/country where work is performed. If multiple locations, list them all. For fully remote jobs, return "Remote"
- Work Model: Identify from keywords:
  * "Remote": remote, work from home, distributed, anywhere, fully remote
  * "Hybrid": hybrid, flexible, X days in office, partial remote, blended
  * "Onsite": on-site, in-office, relocation required, office-based
  * Default to "Unknown" if not clearly specified
- Accessible Link: Use the current page URL, or if iframe content was substantial (IFRAME_X_CONTENT), extract the iframe source URL
- Comment: Create a detailed 5-6 sentence summary describing the main responsibilities, key requirements, and unique aspects of the role

CRITICAL INSTRUCTIONS:
- If information is unclear or not found, use "Unknown" - NO HALLUCINATION
- Return ONLY valid JSON without markdown formatting or code blocks
- Extract iframe URLs when iframe content is substantial (look for IFRAME_X_CROSS_ORIGIN entries)

RESPONSE FORMAT: Return valid JSON with exactly these fields:
{
  "Position Name": "string",
  "Company Name": "string", 
  "Accessible Link": "string",
  "Work Model": "Remote/Hybrid/Onsite/Unknown",
  "Job Location": "string",
  "comment": "5-6 sentence detailed role description"
}

EXAMPLES:
- Remote job: {"Position Name": "Senior Product Manager", "Company Name": "Bynder", "Accessible Link": "https://example.com", "Work Model": "Remote", "Job Location": "Remote", "comment": "Lead AI product strategy and development initiatives across multiple teams. Drive product roadmap definition and prioritization based on market research. Collaborate with engineering and design teams to deliver innovative solutions. Analyze user feedback and metrics to optimize product performance. Manage stakeholder expectations and communicate progress to executive leadership."}
- Hybrid job: {"Position Name": "Software Engineer", "Company Name": "TechCorp", "Accessible Link": "https://example.com", "Work Model": "Hybrid", "Job Location": "Amsterdam, Netherlands", "comment": "Develop and maintain scalable web applications using React and Node.js. Participate in code reviews and ensure adherence to best practices. Collaborate with product managers to translate requirements into technical solutions. Debug and optimize application performance for high-traffic environments. Contribute to architectural decisions and technology stack evolution."}`
        },
        {
          role: 'user',
          content: `Analyze this webpage content and extract comprehensive job information. Pay special attention to page structure, headings, links, iframe content, and prominent text:\n\n${pageText}`
        }
      ],
      max_tokens: 500,
      temperature: 0.1,
      response_format: { type: "json_object" }
    };
    
    debugLog('OpenAI request:', {
      model: requestBody.model,
      systemPromptLength: requestBody.messages[0].content.length,
      userContentLength: requestBody.messages[1].content.length,
      userContentPreview: pageText.substring(0, 300) + '...'
    });
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      debugLog('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    debugLog('OpenAI raw response:', data);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message?.content) {
      debugLog('Invalid OpenAI response structure');
      throw new Error('Invalid response from OpenAI API');
    }
    
    const content = data.choices[0].message.content;
    debugLog('OpenAI content to parse:', content);
    
    try {
      const jobInfo = JSON.parse(content);
      debugLog('Parsed job info:', jobInfo);
      
      // Validate the response
      if (!jobInfo["Position Name"] || !jobInfo["Company Name"]) {
        debugLog('Missing required fields in response:', {
          hasPositionName: !!jobInfo["Position Name"],
          hasCompanyName: !!jobInfo["Company Name"],
          jobInfo: jobInfo
        });
        throw new Error('Missing required fields in OpenAI response');
      }
      
      return jobInfo;
    } catch (parseError) {
      debugLog('Failed to parse OpenAI response:', {
        content: content,
        parseError: parseError.message
      });
      throw new Error('Failed to parse job information from OpenAI response');
    }
  }
  
  async function sendToWebhook(jobData, retryCount = 0) {
    const webhookUrl = localApiUrlInput.value.trim();
    if (!webhookUrl) {
      throw new Error('Please enter your webhook URL');
    }
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Job-Extractor-Extension/1.0',
          'X-Extension-Version': '1.0'
        },
        body: JSON.stringify(jobData)
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        
        // Retry on server errors (5xx) but not client errors (4xx)
        if (response.status >= 500 && retryCount < 2) {
          console.warn(`Webhook failed with ${response.status}, retrying... (attempt ${retryCount + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive delay
          return await sendToWebhook(jobData, retryCount + 1);
        }
        
        throw new Error(`Webhook error: ${response.status} - ${errorText || response.statusText}`);
      }
      
      return await response.json().catch(() => ({ success: true }));
    } catch (error) {
      if (error.name === 'TypeError' && retryCount < 2) {
        console.warn('Network error, retrying...', error);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return await sendToWebhook(jobData, retryCount + 1);
      }
      throw error;
    }
  }
  
  async function getPageTitle() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      return tab.title || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.className = 'status';
      }, 5000);
    }
  }
  
  function saveSettings() {
    const settings = {
      openaiKey: openaiKeyInput.value,
      localApiUrl: localApiUrlInput.value
    };
    
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
      }
    });
  }
  
  function loadSettings() {
    const config = getConfig();
    
    chrome.storage.sync.get(['openaiKey', 'localApiUrl'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading settings:', chrome.runtime.lastError);
        return;
      }
      
      if (result.openaiKey) {
        openaiKeyInput.value = result.openaiKey;
      }
      
      // Use saved URL or fall back to default
      if (result.localApiUrl) {
        localApiUrlInput.value = result.localApiUrl;
      } else {
        localApiUrlInput.value = config.defaultWebhookUrl;
      }
    });
  }
}); 