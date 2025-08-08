// Content script that runs on all pages
// This script extracts page content when requested

// Prevent multiple injections
if (window.jobExtractorLoaded) {
  console.log('Job extractor already loaded');
} else {
  window.jobExtractorLoaded = true;

// Simple delay to allow SPA content to load
async function waitForPageLoad(delayMs = null) {
  // Use configured delay or default
  const actualDelay = delayMs || (typeof getConfig === 'function' ? getConfig().pageLoadDelay : 8000);
  console.log(`Waiting ${actualDelay}ms for page content to load...`);
  await new Promise(resolve => setTimeout(resolve, actualDelay));
  console.log('Wait complete, proceeding with extraction');
}



// Function to extract site-specific data
function extractSiteSpecificData() {
  let siteInfo = '';
  const hostname = window.location.hostname;
  const url = window.location.href;
  
  // LinkedIn specific extraction
  if (hostname.includes('linkedin.com')) {
    const jobTitleElement = document.querySelector('h1[class*="job"], h1[class*="title"]');
    if (jobTitleElement && jobTitleElement.textContent.trim()) {
      siteInfo += `LINKEDIN_JOB_TITLE: ${jobTitleElement.textContent.trim()}\n`;
    }
    
    const companyNameElement = document.querySelector('a[href*="/company/"] span, .company-name, [class*="company"] a');
    if (companyNameElement && companyNameElement.textContent.trim()) {
      siteInfo += `LINKEDIN_COMPANY: ${companyNameElement.textContent.trim()}\n`;
    }
  }
  
  // Greenhouse (used by many companies) - check for gh_jid parameter or greenhouse domains
  else if (url.includes('gh_jid=') || hostname.includes('greenhouse') || url.includes('greenhouse')) {
    siteInfo += `GREENHOUSE_DETECTED: This appears to be a Greenhouse job posting\n`;
    
    // Look for multiple possible job title selectors for different Greenhouse implementations
    const jobTitleSelectors = [
      'h1', 'h2', 'h3',
      '[data-qa="job-title"]', '.job-title', '.posting-headline',
      '.job-post-title', '.position-title', '.role-title',
      '[class*="job-title"]', '[class*="position"]', '[class*="role"]',
      'header h1', 'header h2', '.header h1', '.header h2'
    ];
    
    for (const selector of jobTitleSelectors) {
      const jobTitle = document.querySelector(selector);
      if (jobTitle && jobTitle.textContent.trim() && 
          !jobTitle.textContent.toLowerCase().includes('iterable') &&
          jobTitle.textContent.trim().length > 5) {
        siteInfo += `GREENHOUSE_JOB_TITLE: ${jobTitle.textContent.trim()}\n`;
        break; // Found one, don't need to check more
      }
    }
    
    // Also try to find any text that looks like a job title in the visible content
    const allText = document.body.innerText || '';
    const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    for (const line of lines.slice(0, 20)) { // Check first 20 lines
      // Look for patterns that might be job titles
      if (line.match(/^(Senior|Lead|Principal|Staff|Junior|Manager|Director|Engineer|Developer|Designer|Analyst|Specialist|Coordinator)\s+/i) &&
          line.length < 100 && 
          !line.toLowerCase().includes('iterable') &&
          !line.toLowerCase().includes('company') &&
          !line.toLowerCase().includes('about')) {
        siteInfo += `GREENHOUSE_POTENTIAL_TITLE: ${line}\n`;
        break;
      }
    }
    
    // Company name often in header or navigation
    const companyLogo = document.querySelector('[alt*="logo"], .company-logo, .header-company-name, [alt*="iterable"]');
    if (companyLogo) {
      const companyName = companyLogo.alt || companyLogo.textContent;
      if (companyName && companyName.trim()) {
        siteInfo += `GREENHOUSE_COMPANY: ${companyName.trim()}\n`;
      }
    }
  }
  
  // Lever job boards
  else if (hostname.includes('lever.co') || url.includes('lever.co')) {
    siteInfo += `LEVER_DETECTED: This appears to be a Lever job posting\n`;
    
    const jobTitle = document.querySelector('h1, .posting-headline h2, [data-qa="job-title"]');
    if (jobTitle && jobTitle.textContent.trim()) {
      siteInfo += `LEVER_JOB_TITLE: ${jobTitle.textContent.trim()}\n`;
    }
    
    const companyName = document.querySelector('.main-header-link, .company-name');
    if (companyName && companyName.textContent.trim()) {
      siteInfo += `LEVER_COMPANY: ${companyName.textContent.trim()}\n`;
    }
  }
  
  // Workday job boards
  else if (hostname.includes('myworkdayjobs.com') || url.includes('workday')) {
    siteInfo += `WORKDAY_DETECTED: This appears to be a Workday job posting\n`;
    
    const jobTitle = document.querySelector('h1, [data-automation-id="jobPostingHeader"]');
    if (jobTitle && jobTitle.textContent.trim()) {
      siteInfo += `WORKDAY_JOB_TITLE: ${jobTitle.textContent.trim()}\n`;
    }
  }
  
  // Bamboo HR
  else if (hostname.includes('bamboohr.com') || url.includes('bamboohr')) {
    const jobTitle = document.querySelector('h1, .job-title');
    if (jobTitle && jobTitle.textContent.trim()) {
      siteInfo += `BAMBOO_JOB_TITLE: ${jobTitle.textContent.trim()}\n`;
    }
  }
  
  // Generic company career pages
  else if (url.includes('/career') || url.includes('/job') || url.includes('/position')) {
    siteInfo += `CAREER_PAGE_DETECTED: This appears to be a company career page\n`;
    
    // Try to extract company name from domain
    const domainParts = hostname.split('.');
    if (domainParts.length >= 2) {
      const companyFromDomain = domainParts[domainParts.length - 2];
      siteInfo += `DOMAIN_COMPANY: ${companyFromDomain}\n`;
    }
  }
  
  return siteInfo;
}

// Function to extract content from iframes
async function extractIframeContent() {
  const iframes = document.querySelectorAll('iframe');
  let iframeContent = '';
  
  for (let i = 0; i < iframes.length; i++) {
    const iframe = iframes[i];
    try {
      // Try to access iframe content (will fail for cross-origin iframes)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc && iframeDoc.body) {
        const iframeText = iframeDoc.body.innerText || iframeDoc.body.textContent || '';
        if (iframeText.length > 100) { // Only include substantial content
          iframeContent += `\nIFRAME_${i + 1}_CONTENT:\n${iframeText}\n`;
        }
        
        // Also extract structured data from iframe
        const iframeH1s = iframeDoc.querySelectorAll('h1, h2, h3');
        iframeH1s.forEach((h, index) => {
          if (h.textContent.trim() && index < 3) {
            iframeContent += `IFRAME_${i + 1}_HEADING_${index + 1}: ${h.textContent.trim()}\n`;
          }
        });
      }
    } catch (error) {
      // Cross-origin iframe - we can't access its content directly
      const src = iframe.src || iframe.getAttribute('data-src') || '';
      if (src) {
        iframeContent += `\nIFRAME_${i + 1}_CROSS_ORIGIN: ${src} (cannot access cross-origin content)\n`;
      }
    }
  }
  
  return iframeContent;
}

// Function to extract clean text from the page
async function extractPageText() {
  // Simple wait for SPA content to load
  await waitForPageLoad();
  
  // Create a clone to avoid modifying the original page
  const bodyClone = document.body.cloneNode(true);
  
  // Remove script and style elements from the clone
  const unwantedElements = bodyClone.querySelectorAll('script, style, noscript, nav, footer, header, .sidebar, .ads, .advertisement');
  unwantedElements.forEach(el => el.remove());
  
  // Get text content from body, but clean it up
  let text = bodyClone.innerText || bodyClone.textContent || '';
  
  // Clean up the text - remove extra whitespace, but preserve line structure for better analysis
  text = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/[\t\r]/g, ' ') // Replace tabs and carriage returns
    .trim();
  
  // Extract key structural elements that are important for job/company identification
  let structuralInfo = '';
  
  // Get page title - often contains job title and company
  if (document.title) {
    structuralInfo += `PAGE_TITLE: ${document.title}\n`;
  }
  
  // Get main heading (h1) - often contains job title
  const h1Elements = document.querySelectorAll('h1');
  h1Elements.forEach((h1, index) => {
    if (h1.textContent.trim()) {
      structuralInfo += `H1_HEADING_${index + 1}: ${h1.textContent.trim()}\n`;
    }
  });
  
  // Get company links - particularly useful for LinkedIn
  const companyLinks = document.querySelectorAll('a[href*="/company/"], a[href*="company"]');
  companyLinks.forEach((link, index) => {
    if (link.textContent.trim() && index < 5) { // Limit to first 5 company links
      structuralInfo += `COMPANY_LINK_${index + 1}: ${link.textContent.trim()}\n`;
    }
  });
  
  // Get breadcrumb information
  const breadcrumbs = document.querySelectorAll('nav[aria-label*="breadcrumb"] a, .breadcrumb a, [class*="breadcrumb"] a');
  breadcrumbs.forEach((crumb, index) => {
    if (crumb.textContent.trim() && index < 5) {
      structuralInfo += `BREADCRUMB_${index + 1}: ${crumb.textContent.trim()}\n`;
    }
  });
  
  // Combine structural info with page text
  let fullText = structuralInfo + '\nPAGE_CONTENT:\n' + text;
  
  // Add site-specific extraction logic
  const siteSpecificInfo = extractSiteSpecificData();
  if (siteSpecificInfo) {
    structuralInfo += siteSpecificInfo;
  }
  
  // Extract iframe content (important for Greenhouse and other job boards)
  const iframeContent = await extractIframeContent();
  if (iframeContent) {
    structuralInfo += iframeContent;
  }
  
  fullText = structuralInfo + '\nPAGE_CONTENT:\n' + text;
  
  // Increase the text limit since we want the LLM to see more context
  // but still need to respect API limits
  const maxLength = typeof getConfig === 'function' ? getConfig().maxTextLength : 12000;
  if (fullText.length > maxLength) {
    // Keep the structural info and truncate the page content
    const structuralLength = structuralInfo.length;
    const remainingSpace = maxLength - structuralLength - 100; // Leave some buffer
    const truncatedPageContent = text.substring(0, remainingSpace) + '...';
    fullText = structuralInfo + '\nPAGE_CONTENT:\n' + truncatedPageContent;
  }
  
  return fullText;
}

// Function to extract only main page content (skip iframes)
async function extractMainPageOnly() {
  // Simple wait for SPA content to load
  await waitForPageLoad();
  
  // Create a clone to avoid modifying the original page
  const bodyClone = document.body.cloneNode(true);
  
  // Remove script and style elements from the clone
  const unwantedElements = bodyClone.querySelectorAll('script, style, noscript, nav, footer, header, .sidebar, .ads, .advertisement');
  unwantedElements.forEach(el => el.remove());
  
  // Get text content from body, but clean it up
  let text = bodyClone.innerText || bodyClone.textContent || '';
  
  // Clean up the text - remove extra whitespace, but preserve line structure for better analysis
  text = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/[\t\r]/g, ' ') // Replace tabs and carriage returns
    .trim();
  
  // Extract key structural elements that are important for job/company identification
  let structuralInfo = '';
  
  // Get page title - often contains job title and company
  if (document.title) {
    structuralInfo += `PAGE_TITLE: ${document.title}\n`;
  }
  
  // Get main heading (h1) - often contains job title
  const h1Elements = document.querySelectorAll('h1');
  h1Elements.forEach((h1, index) => {
    if (h1.textContent.trim()) {
      structuralInfo += `H1_HEADING_${index + 1}: ${h1.textContent.trim()}\n`;
    }
  });
  
  // Get company links - particularly useful for LinkedIn
  const companyLinks = document.querySelectorAll('a[href*="/company/"], a[href*="company"]');
  companyLinks.forEach((link, index) => {
    if (link.textContent.trim() && index < 5) { // Limit to first 5 company links
      structuralInfo += `COMPANY_LINK_${index + 1}: ${link.textContent.trim()}\n`;
    }
  });
  
  // Get breadcrumb information
  const breadcrumbs = document.querySelectorAll('nav[aria-label*="breadcrumb"] a, .breadcrumb a, [class*="breadcrumb"] a');
  breadcrumbs.forEach((crumb, index) => {
    if (crumb.textContent.trim() && index < 5) {
      structuralInfo += `BREADCRUMB_${index + 1}: ${crumb.textContent.trim()}\n`;
    }
  });
  
  // Add site-specific extraction logic (but skip iframe extraction)
  const siteSpecificInfo = extractSiteSpecificData();
  if (siteSpecificInfo) {
    structuralInfo += siteSpecificInfo;
  }
  
  let fullText = structuralInfo + '\nPAGE_CONTENT:\n' + text;
  
  // Increase the text limit since we want the LLM to see more context
  // but still need to respect API limits
  const maxLength = typeof getConfig === 'function' ? getConfig().maxTextLength : 12000;
  if (fullText.length > maxLength) {
    // Keep the structural info and truncate the page content
    const structuralLength = structuralInfo.length;
    const remainingSpace = maxLength - structuralLength - 100; // Leave some buffer
    const truncatedPageContent = text.substring(0, remainingSpace) + '...';
    fullText = structuralInfo + '\nPAGE_CONTENT:\n' + truncatedPageContent;
  }
  
  return fullText;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractPageText') {
    // Handle async extraction
    (async () => {
      try {
        // Check if main frame only extraction is requested
        const pageText = request.mainFrameOnly ? 
          await extractMainPageOnly() : 
          await extractPageText();
        
        const currentUrl = window.location.href;
        const pageTitle = document.title;
        const domain = window.location.hostname;
        
        // Additional metadata that might be useful
        const metadata = {
          domain: domain,
          title: pageTitle,
          url: currentUrl,
          timestamp: new Date().toISOString(),
          textLength: pageText.length,
          userAgent: navigator.userAgent
        };
        
        sendResponse({
          success: true,
          text: pageText,
          url: currentUrl,
          metadata: metadata
        });
      } catch (error) {
        console.error('Content script error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

// Optional: Add a visual indicator when the extension is active
function addExtensionIndicator() {
  // Only add if not already present
  if (document.getElementById('job-extractor-indicator')) return;
  
  const indicator = document.createElement('div');
  indicator.id = 'job-extractor-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4285f4;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    opacity: 0.8;
    pointer-events: none;
  `;
  indicator.textContent = 'Job Extractor Ready';
  document.body.appendChild(indicator);
  
  // Remove indicator after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 3000);
}

// Add indicator when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addExtensionIndicator);
} else {
  addExtensionIndicator();
}

} // End of jobExtractorLoaded check 