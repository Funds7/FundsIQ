let activeModal = null;


// =====================================
// LOAD MODAL CSS
// =====================================

function loadModalStyles() {
    if (document.getElementById("fundsiq-modal-styles")) return;

    const link = document.createElement("link");

    link.id = "fundsiq-modal-styles";
    link.rel = "stylesheet";
    link.href = new URL("./modals.css", import.meta.url).href;

    document.head.appendChild(link);
}


// =====================================
// SHOW FUNDSIQ MODAL
// =====================================

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

        // OVERLAY
        const overlay = document.createElement("div");
        overlay.className = "fiq-modal-overlay";

        // MODAL BOX
        const dialog = document.createElement("section");

        dialog.className = `fiq-modal fiq-modal--${type}`;

        dialog.setAttribute("role", "alertdialog");
        dialog.setAttribute("aria-modal", "true");

        // ICON
        const icon = document.createElement("div");

        icon.className = "fiq-modal__icon";
        icon.textContent = icons[type] || icons.info;

        // TITLE
        const heading = document.createElement("h2");

        heading.className = "fiq-modal__title";
        heading.textContent = title;

        // MESSAGE
        const body = document.createElement("p");

        body.className = "fiq-modal__message";
        body.textContent = message;

        dialog.append(icon, heading, body);


        // OPTIONAL DETAILS
        if (details) {

            const extra = document.createElement("div");

            extra.className = "fiq-modal__details";
            extra.textContent = details;

            dialog.append(extra);
        }


        // ACTION BUTTON
        const button = document.createElement("button");

        button.className = "fiq-modal__action";
        button.type = "button";
        button.textContent = buttonText;

        dialog.append(button);

        overlay.append(dialog);

        document.body.append(overlay);

        activeModal = overlay;

        document.body.classList.add("fiq-modal-open");


        // CLOSE MODAL
        let closed = false;

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                close();
            }
        };

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


        // BUTTON CLICK
        button.addEventListener("click", close);


        // OUTSIDE CLICK
        overlay.addEventListener("click", (event) => {

            if (event.target === overlay) {
                close();
            }

        });


        // ESCAPE KEY
        document.addEventListener("keydown", onKeyDown);


        // SHOW ANIMATION
        requestAnimationFrame(() => {

            overlay.classList.add("is-visible");

            button.focus();

        });

    });

}