import { checkAndResetMinutes } from './shared.js';

// Keep track of active intervals for each site
let activeIntervals = {};

// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  async function (details) {
    // Get the list of blocked sites
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];

    // Check if the URL contains any of the blocked sites
    // Extract domain from URL
    const urlObj = new URL(details.url);
    const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    const matchedSite = blockedSites.find(site =>
      domain === site.url.toLowerCase()
    );

    if (matchedSite) {
      // If minutes per day is 0, block completely
      if (matchedSite.minutesPerDay === 0) {
        return { redirectUrl: browser.runtime.getURL("blocked.html") };
      }

      // Check if we need to reset the counter
      if (checkAndResetMinutes(matchedSite)) {
        await updateSiteInStorage(matchedSite);
      }

      // If user has exceeded their time, block access
      if (matchedSite.minutesUsedToday >= matchedSite.minutesPerDay) {
        return { redirectUrl: browser.runtime.getURL("blocked.html") };
      }

      // Start tracking time if not already tracking
      startTimeTracking(matchedSite);
    }
  },
  {
    urls: ["<all_urls>"],
    types: ["main_frame"]
  },
  ["blocking"]
);



// Function to update a site in storage
async function updateSiteInStorage(updatedSite) {
  const result = await browser.storage.local.get('blockedSites');
  const blockedSites = result.blockedSites || [];
  const index = blockedSites.findIndex(site => site.url === updatedSite.url);

  if (index !== -1) {
    blockedSites[index] = updatedSite;
    await browser.storage.local.set({ blockedSites });
  }
}

function stopInterval(url) {
  clearInterval(activeIntervals[url]);
  delete activeIntervals[url];
}

// Function to start tracking time for a site
function startTimeTracking(site) {
  // If already tracking this site, don't start another interval
  if (activeIntervals[site.url]) {
    return;
  }

  // Start a new interval for this site
  activeIntervals[site.url] = setInterval(async () => {
    // Get fresh data from storage
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];
    const currentSite = blockedSites.find(s => s.url === site.url);

    if (currentSite) {
      checkAndResetMinutes(currentSite);
      currentSite.minutesUsedToday++;
      await updateSiteInStorage(currentSite);

      // If time limit reached
      if (currentSite.minutesUsedToday >= currentSite.minutesPerDay) {
        // Clear the interval
        stopInterval(site.url);

        // Find and reload any tabs that are on this site
        const tabs = await browser.tabs.query({});
        tabs.forEach(tab => {
          if (tab.url.toLowerCase().includes(currentSite.url.toLowerCase())) {
            browser.tabs.reload(tab.id);
          }
        });
      }
    }
    else {
      stopInterval(site.url);
    }
  }, 60000); // Run every minute
}

// When a tab is closed, check if there are any tabs left for the site
// If there are no tabs left, stop the interval
browser.tabs.onRemoved.addListener(async (tabId) => {
  const tabs = await browser.tabs.query({});
  const closingTabUrl = tabs.find(tab => tab.id == tabId).url;
  const closingTabKey = Object.keys(activeIntervals).find(url => closingTabUrl.includes(url));

  if (tabs.filter(tab => tab.id != tabId && tab.url.toLowerCase().includes(closingTabKey)).length == 0) {
    stopInterval(closingTabKey);
  }
}); 