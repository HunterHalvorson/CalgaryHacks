/**
 * background.js — Service worker
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#333" });
});
