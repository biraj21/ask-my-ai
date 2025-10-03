import { isItMac } from "./utils";

const modifierKeyElement = document.getElementById("modifier-key");
if (modifierKeyElement && isItMac()) {
  modifierKeyElement.textContent = "⌘";
}

document.getElementById("open-sidebar")?.addEventListener("click", async () => {
  try {
    const currWindow = await chrome.windows.getCurrent();
    if (currWindow.id) {
      await chrome.sidePanel.open({ windowId: currWindow.id });
      // Optionally close the popup after opening side panel
    }
  } catch (error) {
    console.error("Error opening side panel:", error);
  }
});
