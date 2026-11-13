let activeModal = null;

function loadModalStyles() {
    if (document.getElementById("fundsiq-modal-styles")) return;

    const link = document.createElement("link");
    link.id = "fundsiq-modal-styles";
    link.rel = "stylesheet";
    link.href = new URL("./modals.css", import.meta.url).href;

    document.head.appendChild(link);
}

export function showModal({
    type = "info",
    title = "FundsIQ",
    message = "",
    details = "",
    buttonText = "Continue"
} = {}) {

    loadModalStyles();

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

        let closed = false;

        const close = () => {
            if (closed) return;
            closed = true;

            overlay.classList.add("is-closing");
            document.body.classList.remove("fiq-modal-open");

            document.removeEventListener("keydown", onKeyDown);

            setTimeout(() => {
                overlay.remove();

                if (activeModal === overlay) {
                    activeModal = null;
                }

                resolve();
            }, 150);
        };

        const onKeyDown = (event) => {
            if (event.key === "Escape") close();
        };

        button.addEventListener("click", close);

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) close();
        });

        document.addEventListener("keydown", onKeyDown);

        requestAnimationFrame(() => {
            overlay.classList.add("is-visible");
            button.focus();
        });

    });
}