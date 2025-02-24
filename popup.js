// Function to display blocked sites
async function displayBlockedSites() {
  try {
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];
    const listElement = document.getElementById('blockedSitesList');

    listElement.innerHTML = blockedSites.length
      ? blockedSites.map(site => `
          <li>
            <span>${site}</span>
            <button class="delete-btn" data-site="${site}">×</button>
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
    const updatedSites = blockedSites.filter(site => site !== siteToDelete);
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

  try {
    // Get existing blocked sites
    const result = await browser.storage.local.get('blockedSites');
    const blockedSites = result.blockedSites || [];

    // Add new site if it's not already blocked
    if (!blockedSites.includes(url)) {
      blockedSites.push(url);
      await browser.storage.local.set({ blockedSites });
      document.getElementById('websiteUrl').value = '';

      // Refresh the displayed list
      await displayBlockedSites();
    }
  } catch (error) {
    console.error('Error saving blocked site:', error);
  }
}); 