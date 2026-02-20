chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === "analyze") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        sendResponse({ status: "no_tab" });
        return;
      }
      const tabId = tabs[0].id;

      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          files: ["content.js"],
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error("executeScript error:", chrome.runtime.lastError);
            sendResponse({
              status: "error",
              message: chrome.runtime.lastError.message,
            });
            return;
          }
          sendResponse({ status: "injected" });
        }
      );
    });

    return true;
  }
});
