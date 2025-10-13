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
    error: { bg: "#1f2937", color: "#fca5a5" },
    success: { bg: "#1f2937", color: "#86efac" },
    info: { bg: "#1f2937", color: "#93c5fd" },
  };

  const style = styles[type];

  shadow.innerHTML = `
    <style>
      :host {
        display: block;
        margin-top: 12px;
        pointer-events: auto;
      }
      
      .toast {
        background: ${style.bg};
        backdrop-filter: blur(12px);
        padding: 14px 18px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        box-shadow: 
          0 4px 6px -1px rgba(0, 0, 0, 0.1),
          0 2px 4px -1px rgba(0, 0, 0, 0.06),
          0 0 0 1px rgba(255, 255, 255, 0.1);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
        transform: translateY(10px) scale(0.95);
        min-width: 280px;
        max-width: 400px;
        box-sizing: border-box;
      }
      
      .toast.show {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      
      .toast:hover {
        transform: translateY(-2px) scale(1);
        box-shadow: 
          0 10px 15px -3px rgba(0, 0, 0, 0.2),
          0 4px 6px -2px rgba(0, 0, 0, 0.1),
          0 0 0 1px rgba(255, 255, 255, 0.1);
      }
      
      .toast-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .toast-message {
        flex: 1;
        line-height: 1.4;
        color: #ffffff;
      }
      
      .toast-close {
        opacity: 0.5;
        font-size: 18px;
        line-height: 1;
        color: #ffffff;
        flex-shrink: 0;
        transition: opacity 0.2s;
        font-weight: 300;
      }
      
      .toast:hover .toast-close {
        opacity: 1;
      }
    </style>
    <div class="toast">
      <div class="toast-content">
        <div class="toast-message">${message}</div>
        <span class="toast-close">×</span>
      </div>
    </div>
  `;

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
