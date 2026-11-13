let activeModal = null;


// =====================================
// LOAD MODAL STYLES
// =====================================

function loadModalStyles() {

    if (!document.getElementById("fundsiq-modal-styles")) {

        const link = document.createElement("link");

        link.id = "fundsiq-modal-styles";
        link.rel = "stylesheet";
        link.href = new URL("./modals.css", import.meta.url).href;

        document.head.appendChild(link);
    }

    if (document.getElementById("fundsiq-extra-modal-styles")) return;

    const style = document.createElement("style");

    style.id = "fundsiq-extra-modal-styles";

    style.textContent = `

        .fiq-modal__buttons {
            display: flex;
            gap: 10px;
            margin-top: 22px;
        }

        .fiq-modal__buttons button {
            flex: 1;
            min-width: 0;
            min-height: 49px;
            padding: 12px 10px;
            border: none;
            border-radius: 13px;
            font-size: 14px;
            font-weight: 750;
            cursor: pointer;
            touch-action: manipulation;
        }

        .fiq-modal__cancel {
            background: rgba(148,163,184,0.15);
            color: #cbd5e1;
            border: 1px solid rgba(148,163,184,0.2) !important;
        }

        .fiq-modal__confirm {
            background: linear-gradient(110deg,#2563eb,#5945e8);
            color: white;
        }

        .fiq-modal__input {
            width: 100%;
            box-sizing: border-box;
            margin-top: 18px;
            padding: 15px;
            border-radius: 13px;
            border: 1px solid rgba(148,163,184,0.25);
            background: #0b1424;
            color: white;
            font-size: 16px;
            outline: none;
        }

        .fiq-modal__input:focus {
            border-color: #60a5fa;
            box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }

    `;

    document.head.appendChild(style);
}


// =====================================
// CREATE MODAL
// =====================================

function createModal({
    type = "info",
    title = "FundsIQ",
    message = "",
    details = "",
    input = null,
    buttons = []
} = {}) {

    loadModalStyles();

    if (activeModal) {

        activeModal.remove();

        activeModal = null;

        document.body.classList.remove("fiq-modal-open");
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


        // OPTIONAL DETAILS

        if (details) {

            const extra = document.createElement("div");

            extra.className = "fiq-modal__details";
            extra.textContent = details;

            dialog.append(extra);
        }


        // OPTIONAL INPUT

        let inputElement = null;

        if (input) {

            inputElement = document.createElement("input");

            inputElement.className = "fiq-modal__input";

            inputElement.type = input.type || "text";

            inputElement.placeholder = input.placeholder || "";

            inputElement.value = input.value ?? "";

            inputElement.autocomplete = "off";

            if (input.maxLength) {
                inputElement.maxLength = input.maxLength;
            }

            if (input.min !== undefined) {
                inputElement.min = input.min;
            }

            if (input.max !== undefined) {
                inputElement.max = input.max;
            }

            dialog.append(inputElement);
        }


        // BUTTONS

        const buttonContainer = document.createElement("div");

        buttonContainer.className = buttons.length > 1
            ? "fiq-modal__buttons"
            : "";

        let closed = false;

        const cleanup = () => {

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

            }, 150);
        };


        const finish = (value) => {

            if (closed) return;

            cleanup();

            resolve(value);
        };


        buttons.forEach(item => {

            const button = document.createElement("button");

            button.type = "button";

            button.textContent = item.text;

            button.className = item.primary
                ? "fiq-modal__action fiq-modal__confirm"
                : buttons.length > 1
                    ? "fiq-modal__cancel"
                    : "fiq-modal__action";

            if (buttons.length === 1) {
                button.style.marginTop = "22px";
            }

            button.addEventListener("click", () => {

                if (item.submitInput && inputElement) {

                    finish(inputElement.value.trim());

                } else {

                    finish(item.value);
                }

            });

            buttonContainer.appendChild(button);
        });

        dialog.append(buttonContainer);

        overlay.append(dialog);

        document.body.append(overlay);

        activeModal = overlay;

        document.body.classList.add("fiq-modal-open");


        // KEYBOARD SUPPORT

        const onKeyDown = (event) => {

            if (event.key === "Escape") {

                finish(null);

            }

            if (
                event.key === "Enter" &&
                inputElement
            ) {

                event.preventDefault();

                const submitButton =
                    buttonContainer.querySelector(
                        ".fiq-modal__confirm"
                    );

                if (submitButton) {
                    submitButton.click();
                }
            }
        };

        document.addEventListener("keydown", onKeyDown);


        // OUTSIDE CLICK

        overlay.addEventListener("click", (event) => {

            if (event.target === overlay) {

                finish(null);
            }
        });


        // ANIMATION

        requestAnimationFrame(() => {

            overlay.classList.add("is-visible");

            if (inputElement) {

                inputElement.focus();

                inputElement.select();

            } else {

                const firstButton =
                    buttonContainer.querySelector("button");

                if (firstButton) {
                    firstButton.focus();
                }
            }

        });

    });
}


// =====================================
// INFORMATION MODAL
// =====================================

export function showModal({
    type = "info",
    title = "FundsIQ",
    message = "",
    details = "",
    buttonText = "Continue"
} = {}) {

    return createModal({

        type,
        title,
        message,
        details,

        buttons: [
            {
                text: buttonText,
                value: true,
                primary: true
            }
        ]

    });
}


// =====================================
// CONFIRMATION MODAL
// =====================================

export function showConfirmModal({
    type = "warning",
    title = "Confirm Action",
    message = "Are you sure you want to continue?",
    details = "",
    confirmText = "Yes, Continue",
    cancelText = "Cancel"
} = {}) {

    return createModal({

        type,
        title,
        message,
        details,

        buttons: [

            {
                text: cancelText,
                value: false,
                primary: false
            },

            {
                text: confirmText,
                value: true,
                primary: true
            }

        ]

    });
}


// =====================================
// INPUT MODAL
// =====================================

export function showInputModal({
    type = "info",
    title = "Enter Details",
    message = "Please enter a value.",
    details = "",
    placeholder = "Enter here...",
    defaultValue = "",
    inputType = "text",
    maxLength = 100,
    min,
    max,
    submitText = "Submit",
    cancelText = "Cancel"
} = {}) {

    return createModal({

        type,
        title,
        message,
        details,

        input: {

            type: inputType,

            placeholder,

            value: defaultValue,

            maxLength,

            min,

            max

        },

        buttons: [

            {
                text: cancelText,
                value: null,
                primary: false
            },

            {
                text: submitText,
                submitInput: true,
                primary: true
            }

        ]

    });
    }
