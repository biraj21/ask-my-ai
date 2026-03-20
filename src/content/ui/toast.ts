import { applyShadowStyles, escapeHtml, renderTemplate } from "./shadow";
import toastStyles from "./toast.css?raw";
import toastTemplate from "./toast.html?raw";

// Create a toast notification with Shadow DOM for true CSS isolation
export function showToast(message: string, type: "error" | "success" | "info" = "error", duration: number = 5000) {
  // Check if toast container exists, create if not
  let toastContainer = document.getElementById("ask-my-ai-toast-container");

  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "ask-my-ai-toast-container";
    Object.assign(toastContainer.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "2147483647",
      pointerEvents: "none",
    });
    document.body.appendChild(toastContainer);
  }

  // Create toast wrapper with Shadow DOM
  const toastWrapper = document.createElement("div");
  const shadow = toastWrapper.attachShadow({ mode: "open" });

  // Sleek, professional design
  const styles = {
    error: { bg: "#1f2937" },
    success: { bg: "#1f2937" },
    info: { bg: "#1f2937" },
  };

  const style = styles[type];
  applyShadowStyles(shadow, toastStyles);
  toastWrapper.style.setProperty("--toast-bg", style.bg);

  shadow.innerHTML = renderTemplate(toastTemplate, {
    MESSAGE: escapeHtml(message),
  });

  const toastEl = shadow.querySelector(".toast") as HTMLElement;

  // Add click to dismiss
  toastEl.addEventListener("click", () => {
    removeToast(toastWrapper);
  });

  toastContainer.appendChild(toastWrapper);

  // Smooth slide-in animation
  requestAnimationFrame(() => {
    setTimeout(() => {
      toastEl.classList.add("show");
    }, 10);
  });

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toastWrapper);
    }, duration);
  }
}

function removeToast(toastWrapper: HTMLElement) {
  const shadow = toastWrapper.shadowRoot;
  if (!shadow) return;

  const toastEl = shadow.querySelector(".toast") as HTMLElement;
  if (toastEl) {
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateY(10px) scale(0.95)";
  }

  setTimeout(() => {
    toastWrapper.remove();
  }, 200);
}
