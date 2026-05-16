/**
 * pdfUtils.js
 * Shared utilities for PDF generation across the application.
 */

/**
 * Loads an image from a URL and returns it as a base64 encoded string or HTMLImageElement.
 * @param {string} url 
 * @returns {Promise<HTMLImageElement>}
 */
export const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
};

/**
 * Draws the standard gym header on a jsPDF document.
 * @param {Object} doc - The jsPDF instance
 * @param {Object} gymSettings - The gym settings object
 * @param {string} backendurl - The backend URL for logo fetching
 * @returns {Promise<number>} - The Y position after the header separator
 */
export const drawGymHeader = async (doc, gymSettings, backendurl) => {
    const primaryOrange = [255, 122, 26];
    
    // -- Header with Logo --
    let activeLogo = null;
    if (gymSettings?.gymLogo) {
        try {
            const baseUrl = backendurl.replace('/gym', '').replace(/\/+$/, '');
            const fullLogoUrl = `${baseUrl}${gymSettings.gymLogo}`;
            activeLogo = await loadImage(fullLogoUrl);
        } catch (e) {
            console.error("Logo load failed", e);
        }
    }

    if (activeLogo) {
        try {
            doc.addImage(activeLogo, 'JPEG', 15, 10, 30, 30);
        } catch (e) {
            console.error("Logo add to PDF failed", e);
        }
    }

    // Gym Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...primaryOrange);
    doc.text(gymSettings?.gymName || "Gym Name", 55, 20);

    // Address & Contact Info
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    let addressY = 28;
    const fullAddress = gymSettings?.address || "Gym Address";
    const addressLines = fullAddress.split('\n');
    addressLines.forEach(line => {
        if (line.trim()) {
            doc.text(line.trim(), 55, addressY);
            addressY += 5;
        }
    });

    if (gymSettings?.landmark) {
        doc.text(`Landmark: ${gymSettings.landmark}`, 55, addressY);
        addressY += 5;
    }

    if (gymSettings?.email) {
        doc.text(`Email: ${gymSettings.email}`, 55, addressY);
        addressY += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`Mobile: ${gymSettings?.mobile || "Gym Mobile"}`, 55, addressY + 2);

    // Main Separator Line
    const finalHeaderY = Math.max(addressY + 8, 55);
    doc.setLineWidth(1);
    doc.setDrawColor(...primaryOrange);
    doc.line(15, finalHeaderY, 195, finalHeaderY);

    return finalHeaderY + 10; // Return Y position for content to start
};

/**
 * Draws the standard gym footer on a jsPDF document.
 * @param {Object} doc - The jsPDF instance
 * @param {Object} gymSettings - The gym settings object
 * @param {number} y - The Y position to draw the footer at
 */
export const drawGymFooter = (doc, gymSettings, y) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    
    doc.text(`Thank you for choosing ${gymSettings?.gymName || "our gym"}!`, 105, y, { align: "center" });
    doc.text(`For queries, contact ${gymSettings?.mobile || "our support"}`, 105, y + 5, { align: "center" });
};
