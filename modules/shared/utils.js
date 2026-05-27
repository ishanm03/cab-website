// modules/shared/utils.js

/**
 * Common utilities and input validation helpers for IshanCabs
 */
const utils = {
    /**
     * Validates if a phone number matches the Indian standard (+91XXXXXXXXXX or 10 digits)
     * @param {string} phone - Input phone number
     * @returns {boolean} Valid status
     */
    validateIndianPhone(phone) {
        const cleaned = phone.replace(/\s+/g, "");
        // Regex fits either 10 digits directly or pre-fixed with +91 or 91
        const indianPhoneRegex = /^(?:\+91|91)?[6789]\d{9}$/;
        return indianPhoneRegex.test(cleaned);
    },

    /**
     * Normalizes a phone number to standard E.164 format (+91XXXXXXXXXX)
     * @param {string} phone - Input phone number
     * @returns {string} E.164 formatted number
     */
    formatE164Phone(phone) {
        let cleaned = phone.replace(/\s+/g, "").replace(/[-()]/g, "");
        if (cleaned.startsWith("+91")) {
            return cleaned;
        }
        if (cleaned.startsWith("91") && cleaned.length === 12) {
            return "+" + cleaned;
        }
        // Assumed 10-digit number
        if (cleaned.length === 10) {
            return "+91" + cleaned;
        }
        return cleaned;
    },

    /**
     * Helper to show a DOM element
     * @param {HTMLElement} element 
     */
    showElement(element) {
        if (!element) return;
        element.classList.remove("hidden");
    },

    /**
     * Helper to hide a DOM element
     * @param {HTMLElement} element 
     */
    hideElement(element) {
        if (!element) return;
        element.classList.add("hidden");
    },

    /**
     * Helper to display form feedback messages
     * @param {HTMLElement} alertElement - Target element to render message in
     * @param {string} message - Feedback message text
     * @param {string} type - "success" or "error"
     */
    showAlert(alertElement, message, type = "error") {
        if (!alertElement) return;
        alertElement.textContent = message;
        alertElement.className = "p-4 rounded-xl text-sm font-semibold mb-4 transition-all duration-300";
        
        if (type === "success") {
            alertElement.classList.add("bg-emerald-50", "text-emerald-800", "border", "border-emerald-200");
        } else {
            alertElement.classList.add("bg-rose-50", "text-rose-800", "border", "border-rose-200");
        }
        this.showElement(alertElement);
    }
};

export { utils };
