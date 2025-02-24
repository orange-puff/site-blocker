// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  async function(details) {
    // Get the list of blocked sites
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];
    
    // Check if the URL contains any of the blocked sites
    const url = details.url.toLowerCase();
    const isBlocked = blockedSites.some(site => 
      url.includes(site.toLowerCase())
    );

    // If the site is blocked, redirect to our blocked page
    if (isBlocked) {
      return {
        redirectUrl: browser.runtime.getURL("blocked.html")
      };
    }
  },
  {
    urls: ["<all_urls>"],
    types: ["main_frame"]  // Only block main frame requests, not resources
  },
  ["blocking"]
); 