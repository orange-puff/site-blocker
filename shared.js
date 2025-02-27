export { getNextMidnight, checkAndResetMinutes };

function getNextMidnight() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
}

function checkAndResetMinutes(blockedSite) {
    const now = Date.now();

    if (now >= blockedSite.nextReset) {
        blockedSite.minutesUsedToday = 0;
        blockedSite.nextReset = getNextMidnight();
        return true;
    }

    return false;
}
