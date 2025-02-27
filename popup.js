import { checkAndResetMinutes, getNextMidnight } from './shared.js';



function getMinutesLeftToday(site) {
  if (site.minutesPerDay == 0) {
    return "blocked";
  }
  return `(${site.minutesUsedToday} / ${site.minutesPerDay} minutes left today)`;
}

// Function to display blocked sites
async function displayBlockedSites() {
  try {
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];
    const listElement = document.getElementById('blockedSitesList');

    let needToUpdate = false;
    blockedSites.forEach(site => {
      if (checkAndResetMinutes(site)) {
        needToUpdate = true;
      }
    });

    if (needToUpdate) {
      await browser.storage.local.set({ blockedSites });
    }

    listElement.innerHTML = blockedSites.length
      ? blockedSites.map(site => `
          <li>
            <span>${site.url} ${getMinutesLeftToday(site)}</span>
            <button class="delete-btn" data-site="${site.url}">×</button>
          </li>
        `).join('')
      : '<li>No sites blocked yet</li>';

    // Add event listeners to delete buttons
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', deleteSite);
    });
  } catch (error) {
    console.error('Error loading blocked sites:', error);
  }
}

// Function to delete a site
async function deleteSite(e) {
  const siteToDelete = e.target.dataset.site;
  try {
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];
    const updatedSites = blockedSites.filter(site => site.url !== siteToDelete);
    await browser.storage.local.set({ blockedSites: updatedSites });
    await displayBlockedSites();
  } catch (error) {
    console.error('Error deleting site:', error);
  }
}

// Load blocked sites when popup opens
document.addEventListener('DOMContentLoaded', displayBlockedSites);

// Handle form submission
document.getElementById('blockForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const url = document.getElementById('websiteUrl').value;
  const minutesPerDay = parseInt(document.getElementById('minutesPerDay').value);

  try {
    // Get existing blocked sites
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];

    // Create new site entry
    const newSite = {
      url: url,
      minutesPerDay: minutesPerDay,
      minutesUsedToday: 0,
      nextReset: getNextMidnight()
    };

    // Add new site if it's not already blocked
    if (!blockedSites.some(site => site.url === url)) {
      blockedSites.push(newSite);
      await browser.storage.local.set({ blockedSites });

      // Clear form
      document.getElementById('websiteUrl').value = '';
      document.getElementById('minutesPerDay').value = '0';

      // Refresh the displayed list
      await displayBlockedSites();
    }
  } catch (error) {
    console.error('Error saving blocked site:', error);
  }
}); 