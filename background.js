// Keep track of active intervals for each site
let activeIntervals = {};

// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  async function (details) {
    // Get the list of blocked sites
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];

    // Check if the URL contains any of the blocked sites
    const url = details.url.toLowerCase();
    const matchedSite = blockedSites.find(site =>
      url.includes(site.url.toLowerCase())
    );

    if (matchedSite) {
      // If minutes per day is 0, block completely
      if (matchedSite.minutesPerDay === 0) {
        return { redirectUrl: browser.runtime.getURL("blocked.html") };
      }

      // Check if we need to reset the counter
      const now = Date.now();
      if (now >= matchedSite.nextReset) {
        matchedSite.minutesUsedToday = 0;
        matchedSite.nextReset = getNextMidnight();
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

// Function to get next midnight
function getNextMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

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

    console.log("currentSite", site.url);

    if (currentSite) {
      const now = Date.now();

      // Check if we need to reset
      if (now >= currentSite.nextReset) {
        currentSite.minutesUsedToday = 0;
        currentSite.nextReset = getNextMidnight();
      }

      // Increment minutes used
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
  }, 10000); // Run every minute
}

// Clean up intervals when tab closes
browser.tabs.onRemoved.addListener((tabId) => {
  // Ideally, we'd only clear the interval for the specific site,
  // but we'd need additional tracking to know which tab was for which site
  Object.keys(activeIntervals).forEach(url => {
    stopInterval(url);
  });
}); 