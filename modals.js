import "./modals.css";

let activeModal = null;

export function showModal({
  type = "info",
  title = "FundsIQ",
  message = "",
  details = "",
  buttonText = "Continue"
} = {}) {

  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }

  return new Promise((resolve) => {

    const icons = {
      success: "✓",
      error: "!",
      warning: "⚠",
      info: "i"
    };

    const overlay = document.createElement("div");
    overlay.className = "fiq-modal-overlay";

    const dialog = document.createElement("section");
    dialog.className = `fiq-modal fiq-modal--${type}`;

    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");

    const icon = document.createElement("div");
    icon.className = "fiq-modal__icon";
    icon.textContent = icons[type] || icons.info;

    const heading = document.createElement("h2");
    heading.className = "fiq-modal__title";
    heading.textContent = title;

    const body = document.createElement("p");
    body.className = "fiq-modal__message";
    body.textContent = message;

    dialog.append(icon, heading, body);

    if (details) {
      const extra = document.createElement("div");
      extra.className = "fiq-modal__details";
      extra.textContent = details;
      dialog.append(extra);
    }

    const button = document.createElement("button");
    button.className = "fiq-modal__action";
    button.type = "button";
    button.textContent = buttonText;

    dialog.append(button);
    overlay.append(dialog);

    document.body.append(overlay);

    activeModal = overlay;

    document.body.classList.add("fiq-modal-open");

    const close = () => {

      if (!overlay.isConnected) return;

      overlay.classList.add("is-closing");

      document.body.classList.remove("fiq-modal-open");

      setTimeout(() => {

        overlay.remove();

        if (activeModal === overlay) {
          activeModal = null;
        }

        resolve();

      }, 150);
    };

    button.addEventListener("click", close);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close();
      }
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      button.focus();
    });

  });
}
