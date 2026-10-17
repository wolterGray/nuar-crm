import { UI_LABELS } from "./priceListTranslations.js";

/**
 * Downloads a canvas or blob as a PNG file
 */
function triggerFileDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Renders high-resolution editorial Price List onto an HTML5 Canvas and exports as PNG
 * Supports 1080x1920 (Stories), 1080x1350 (Post), and 1240x1754 (A4)
 */
export async function exportPriceListToPng(priceListData, settings) {
  const { format = "a4", theme = "dark", language = "pl", priceMode = "full", showDescriptions = false } = settings;
  const labels = UI_LABELS[language] || UI_LABELS.pl;

  // Dimensions
  let width = 1240;
  let height = 1754;

  if (format === "stories") {
    width = 1080;
    height = 1920;
  } else if (format === "post") {
    width = 1080;
    height = 1350;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context");
  }

  // Color palette
  const isDark = theme === "dark";
  const bg = isDark ? "#0a0a0a" : "#ffffff";
  const textPrimary = isDark ? "#ffffff" : "#111113";
  const textSecondary = isDark ? "#9e9ea6" : "#63636b";
  const accentRed = "#e11d2e";
  const borderSoft = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const dotColor = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.18)";

  // 1. Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle outer framing
  const margin = Math.round(width * 0.055);
  const contentWidth = width - margin * 2;

  ctx.strokeStyle = borderSoft;
  ctx.lineWidth = 1;
  ctx.strokeRect(margin * 0.6, margin * 0.6, width - margin * 1.2, height - margin * 1.2);

  // Corner brand accents
  const cornerSize = 14;
  ctx.fillStyle = accentRed;
  ctx.fillRect(margin * 0.6 - 1, margin * 0.6 - 1, cornerSize, 2);
  ctx.fillRect(margin * 0.6 - 1, margin * 0.6 - 1, 2, cornerSize);
  ctx.fillRect(width - margin * 0.6 - cornerSize + 1, margin * 0.6 - 1, cornerSize, 2);
  ctx.fillRect(width - margin * 0.6 - 1, margin * 0.6 - 1, 2, cornerSize);

  let currentY = margin + 15;

  // 2. Brand Header
  ctx.textAlign = "center";

  // Monogram / Logo: "NUAR"
  ctx.font = "bold 38px 'Playfair Display', Georgia, serif, system-ui";
  ctx.fillStyle = textPrimary;
  ctx.letterSpacing = "6px";
  ctx.fillText("N U A R", width / 2, currentY);
  currentY += 24;

  // Tagline: "SALON MASAŻU & SPA · WARSZAWA"
  ctx.font = "600 11.5px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = accentRed;
  ctx.letterSpacing = "3.5px";
  ctx.fillText(labels.brandSubtitle, width / 2, currentY);
  currentY += 28;

  // Document Title: "CENNIK USŁUG"
  ctx.font = "500 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = textSecondary;
  ctx.letterSpacing = "2px";
  ctx.fillText(labels.docTitle, width / 2, currentY);
  currentY += 24;

  // Thin header divider line
  ctx.strokeStyle = borderSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 120, currentY);
  ctx.lineTo(width / 2 + 120, currentY);
  ctx.stroke();

  // Small center diamond
  ctx.fillStyle = accentRed;
  ctx.fillRect(width / 2 - 3, currentY - 3, 6, 6);
  currentY += 36;

  // 3. Category & Services Rendering
  ctx.textAlign = "left";
  ctx.letterSpacing = "normal";

  const categories = priceListData.categories || [];
  const maxContentBottom = height - margin - 75;

  for (const cat of categories) {
    if (currentY > maxContentBottom - 60) break;

    // Category Header Box
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    ctx.letterSpacing = "1.8px";
    ctx.fillStyle = textPrimary;
    const catTitle = cat.localizedName.toUpperCase();
    ctx.fillText(catTitle, margin, currentY);

    // Right-aligned subtle line connecting category
    const catTextWidth = ctx.measureText(catTitle).width;
    ctx.strokeStyle = borderSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin + catTextWidth + 16, currentY - 4);
    ctx.lineTo(margin + contentWidth, currentY - 4);
    ctx.stroke();

    currentY += 22;

    // Services list in category
    for (const service of cat.services) {
      if (currentY > maxContentBottom - 30) break;

      const svcName = service.displayName;
      const priceText =
        priceMode === "compact"
          ? `${labels.fromPrice} ${service.minPrice} ${labels.currency}`
          : (service.variants || [])
              .map((v) => `${v.duration} ${labels.minUnit} — ${v.price} ${labels.currency}`)
              .join("   ");

      // Font for service name
      ctx.font = "600 13.5px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "0.2px";
      ctx.fillStyle = textPrimary;
      ctx.fillText(svcName, margin, currentY);

      // Measure text widths for dot leader
      const nameWidth = ctx.measureText(svcName).width;

      // Font for prices
      ctx.font = "600 13px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "0.3px";
      ctx.fillStyle = isDark ? "#ffffff" : "#1a1a1e";
      const priceWidth = ctx.measureText(priceText).width;

      // Render Price (Right aligned)
      ctx.textAlign = "right";
      ctx.fillText(priceText, margin + contentWidth, currentY);
      ctx.textAlign = "left";

      // Render Dotted Leader between name and price
      const dotsStartX = margin + nameWidth + 10;
      const dotsEndX = margin + contentWidth - priceWidth - 10;

      if (dotsEndX > dotsStartX + 20) {
        ctx.fillStyle = dotColor;
        ctx.font = "12px monospace";
        const dotChar = ". ";
        const dotCharWidth = ctx.measureText(dotChar).width;
        let dx = dotsStartX;
        while (dx + dotCharWidth < dotsEndX) {
          ctx.fillText(".", dx, currentY - 1);
          dx += 8;
        }
      }

      currentY += 19;

      // Optional short description if enabled and present
      if (showDescriptions && service.description) {
        ctx.font = "400 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = textSecondary;
        const desc = service.description.length > 95 ? service.description.slice(0, 92) + "..." : service.description;
        ctx.fillText(desc, margin, currentY);
        currentY += 16;
      }

      currentY += 4;
    }

    currentY += 14;
  }

  // 4. Footer Branding & Contacts
  const footerY = height - margin - 20;

  // Subtle footer top line
  ctx.strokeStyle = borderSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, footerY - 28);
  ctx.lineTo(margin + contentWidth, footerY - 28);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "500 11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = textSecondary;
  ctx.letterSpacing = "0.5px";

  const contactLine = `${labels.address}   ·   ${labels.phone}   ·   ${labels.website}`;
  ctx.fillText(contactLine, width / 2, footerY - 10);

  ctx.font = "600 11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = accentRed;
  ctx.letterSpacing = "1px";
  ctx.fillText(`${labels.onlineBooking.toUpperCase()}: ${labels.website.toUpperCase()}`, width / 2, footerY + 8);

  // Return PNG Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob failed"));
        return;
      }
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `nuar-cennik-${language}-${format}-${timestamp}.png`;
      triggerFileDownload(blob, filename);
      resolve({ filename, size: blob.size });
    }, "image/png");
  });
}

/**
 * Triggers clean print / Save as PDF using the browser's native print engine
 */
export function printPriceList() {
  window.print();
}
