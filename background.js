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
      console.log(`[Site Blocker] Matched blocked site: ${matchedSite.url}, minutes used: ${matchedSite.minutesUsedToday}/${matchedSite.minutesPerDay}`);

      // If minutes per day is 0, block completely
      if (matchedSite.minutesPerDay === 0) {
        console.log(`[Site Blocker] Blocking ${matchedSite.url} - 0 minutes allowed`);
        return { redirectUrl: browser.runtime.getURL("blocked.html") };
      }

      // Check if we need to reset the counter
      if (checkAndResetMinutes(matchedSite)) {
        console.log(`[Site Blocker] Counter reset for ${matchedSite.url}`);
        await updateSiteInStorage(matchedSite);
      }

      // If user has exceeded their time, block access
      if (matchedSite.minutesUsedToday >= matchedSite.minutesPerDay) {
        console.log(`[Site Blocker] Blocking ${matchedSite.url} - time limit exceeded`);
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
  if (activeIntervals[url]) {
    console.log(`[Time Tracking] Stopped tracking for ${url}`);
    clearInterval(activeIntervals[url]);
    delete activeIntervals[url];
  }
}

// Function to start tracking time for a site
function startTimeTracking(site) {
  // If already tracking this site, don't start another interval
  if (activeIntervals[site.url]) {
    return;
  }

  console.log(`[Time Tracking] Started tracking for ${site.url}`);

  // Start a new interval for this site
  activeIntervals[site.url] = setInterval(async () => {
    console.log(`[Time Tracking] Checking conditions for ${site.url}...`);

    // Check if Firefox window is focused (active)
    const currentWindow = await browser.windows.getLastFocused();
    const isFirefoxActive = currentWindow.focused;

    console.log(`[Time Tracking] Firefox window focused: ${isFirefoxActive}`);

    if (!isFirefoxActive) {
      console.log(`[Time Tracking] Firefox not active, skipping time deduction for ${site.url}`);
      return;
    }

    // Check if the active tab is one of the blocked site tabs
    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = activeTabs[0];

    if (!activeTab || !activeTab.url) {
      console.log(`[Time Tracking] No active tab found, skipping time deduction for ${site.url}`);
      return;
    }

    const activeTabDomain = new URL(activeTab.url).hostname.toLowerCase().replace(/^www\./, '');
    const isBlockedSiteActive = activeTabDomain === site.url.toLowerCase();

    console.log(`[Time Tracking] Active tab domain: ${activeTabDomain}`);
    console.log(`[Time Tracking] Blocked site: ${site.url}`);
    console.log(`[Time Tracking] Is blocked site active: ${isBlockedSiteActive}`);

    if (!isBlockedSiteActive) {
      console.log(`[Time Tracking] Active tab is not ${site.url}, skipping time deduction`);
      return;
    }

    console.log(`[Time Tracking] All conditions met! Deducting time for ${site.url}`);

    // Get fresh data from storage
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];
    const currentSite = blockedSites.find(s => s.url === site.url);

    if (currentSite) {
      checkAndResetMinutes(currentSite);
      currentSite.minutesUsedToday++;
      console.log(`[Time Tracking] Time deducted. ${site.url} now has ${currentSite.minutesUsedToday} minutes used today`);
      await updateSiteInStorage(currentSite);

      // If time limit reached
      if (currentSite.minutesUsedToday >= currentSite.minutesPerDay) {
        console.log(`[Time Tracking] Time limit reached for ${site.url}!`);
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
      console.log(`[Time Tracking] Site ${site.url} not found in storage, stopping interval`);
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

  if (closingTabKey) {
    const remainingTabs = tabs.filter(tab => tab.id != tabId && tab.url.toLowerCase().includes(closingTabKey)).length;
    console.log(`[Time Tracking] Tab closed for ${closingTabKey}. Remaining tabs: ${remainingTabs}`);

    if (remainingTabs === 0) {
      stopInterval(closingTabKey);
    }
  }
}); 