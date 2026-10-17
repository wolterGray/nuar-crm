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
 * Renders a single page of the price list onto a Canvas
 */
function renderPageToCanvas(page, settings, labels, width, height) {
  const { theme = "dark", priceMode = "full", showDescriptions = false } = settings;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context");
  }

  // Color palette
  const isDark = theme === "dark";
  const bg = isDark ? "#0d0d0f" : "#ffffff";
  const textPrimary = isDark ? "#ffffff" : "#111113";
  const textSecondary = isDark ? "#9e9ea6" : "#63636b";
  const textFaint = isDark ? "#686870" : "#8c8c94";
  const accentRed = "#e11d2e";
  const borderSoft = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const dotColor = isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.18)";

  // 1. Fill Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Outer framing
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

  let currentY = margin + 12;

  // 2. Brand Header
  ctx.textAlign = "center";

  if (page.isFirstPage) {
    // Dominant "NUAR"
    ctx.font = "bold 38px 'Playfair Display', Georgia, serif, system-ui";
    ctx.fillStyle = textPrimary;
    ctx.letterSpacing = "6px";
    ctx.fillText("N U A R", width / 2, currentY);
    currentY += 24;

    // Subtitle: "MASSAGE STUDIO · WARSZAWA"
    ctx.font = "600 11px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = textSecondary;
    ctx.letterSpacing = "3.2px";
    ctx.fillText(labels.brandSubtitle, width / 2, currentY);
    currentY += 26;

    // Document Title: "CENNIK"
    ctx.font = "700 15px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = textPrimary;
    ctx.letterSpacing = "2.5px";
    ctx.fillText(labels.docTitle, width / 2, currentY);
    currentY += 18;

    // Red hairline accent bar
    ctx.fillStyle = accentRed;
    ctx.fillRect(width / 2 - 20, currentY, 40, 2);
    currentY += 32;
  } else {
    // Secondary compact header for subsequent pages
    ctx.font = "bold 18px 'Playfair Display', Georgia, serif, system-ui";
    ctx.fillStyle = textPrimary;
    ctx.letterSpacing = "3px";
    ctx.fillText(`N U A R   ·   ${labels.docTitle} ${labels.continued}`, width / 2, currentY);
    currentY += 16;

    ctx.fillStyle = accentRed;
    ctx.fillRect(width / 2 - 18, currentY, 36, 1.5);
    currentY += 30;
  }

  // 3. Categories and Services
  ctx.textAlign = "left";
  ctx.letterSpacing = "normal";

  const categories = page.categories || [];
  const maxContentBottom = height - margin - 60;

  for (const cat of categories) {
    if (currentY > maxContentBottom - 50) break;

    // Category Header
    ctx.font = "bold 13.5px system-ui, -apple-system, sans-serif";
    ctx.letterSpacing = "1.5px";
    ctx.fillStyle = textPrimary;
    const catTitle = cat.localizedName.toUpperCase();
    ctx.fillText(catTitle, margin, currentY);

    const catTextWidth = ctx.measureText(catTitle).width;
    ctx.strokeStyle = borderSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin + catTextWidth + 14, currentY - 4);
    ctx.lineTo(margin + contentWidth, currentY - 4);
    ctx.stroke();

    currentY += 22;

    // Services list
    for (const service of cat.services) {
      if (currentY > maxContentBottom - 26) break;

      const svcName = service.displayName;
      const variantCount = service.variants?.length || 1;
      const isMultiVariant = priceMode === "full" && variantCount > 1;

      if (isMultiVariant) {
        // Multi-variant Layout: Title on top, structured variant grid underneath
        ctx.font = "600 13.5px system-ui, -apple-system, sans-serif";
        ctx.letterSpacing = "0.2px";
        ctx.fillStyle = textPrimary;
        ctx.fillText(svcName, margin, currentY);
        currentY += 18;

        if (showDescriptions && service.description) {
          ctx.font = "400 11px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = textSecondary;
          ctx.fillText(service.description.slice(0, 95), margin, currentY);
          currentY += 16;
        }

        // Draw variant columns grid
        const variants = service.variants;
        const colWidth = Math.min(105, Math.floor(contentWidth / variants.length));

        variants.forEach((v, vIdx) => {
          const colX = margin + vIdx * colWidth;

          // Duration Header
          ctx.font = "500 10.5px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = textFaint;
          ctx.fillText(`${v.duration} ${labels.minUnit}`.toUpperCase(), colX, currentY);

          // Price underneath
          ctx.font = "700 13px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = textPrimary;
          ctx.fillText(`${v.price} ${labels.currency}`, colX, currentY + 14);
        });

        currentY += 28;
      } else {
        // Single Variant or Compact Mode: Clean Inline Row
        const priceText =
          priceMode === "compact"
            ? `${labels.fromPrice} ${service.minPrice} ${labels.currency}`
            : service.variants?.[0]
              ? `${service.variants[0].duration} ${labels.minUnit} — ${service.variants[0].price} ${labels.currency}`
              : `${service.price} ${labels.currency}`;

        ctx.font = "600 13.5px system-ui, -apple-system, sans-serif";
        ctx.letterSpacing = "0.2px";
        ctx.fillStyle = textPrimary;
        ctx.fillText(svcName, margin, currentY);

        const nameWidth = ctx.measureText(svcName).width;

        ctx.font = "700 13px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = textPrimary;
        const priceWidth = ctx.measureText(priceText).width;

        ctx.textAlign = "right";
        ctx.fillText(priceText, margin + contentWidth, currentY);
        ctx.textAlign = "left";

        // Dot leader
        const dotsStartX = margin + nameWidth + 10;
        const dotsEndX = margin + contentWidth - priceWidth - 10;

        if (dotsEndX > dotsStartX + 20) {
          ctx.fillStyle = dotColor;
          ctx.font = "12px monospace";
          let dx = dotsStartX;
          while (dx + 6 < dotsEndX) {
            ctx.fillText(".", dx, currentY - 1);
            dx += 8;
          }
        }

        currentY += 19;

        if (showDescriptions && service.description) {
          ctx.font = "400 11px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = textSecondary;
          ctx.fillText(service.description.slice(0, 95), margin, currentY);
          currentY += 16;
        }
      }

      currentY += 4;
    }

    currentY += 12;
  }

  // 4. Footer Branding & Contacts
  const footerY = height - margin - 15;

  ctx.strokeStyle = borderSoft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, footerY - 26);
  ctx.lineTo(margin + contentWidth, footerY - 26);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "500 11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = textSecondary;
  ctx.letterSpacing = "0.5px";

  const contactLine = `${labels.address}   ·   ${labels.phone}   ·   ${labels.website}`;
  ctx.fillText(contactLine, width / 2, footerY - 8);

  ctx.font = "600 10.5px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = accentRed;
  ctx.letterSpacing = "1.2px";

  const pageNumText = page.totalPages > 1 ? `   [${labels.pageLabel} ${page.pageIndex} ${labels.ofLabel} ${page.totalPages}]` : "";
  ctx.fillText(`${labels.onlineBooking.toUpperCase()}: ${labels.website.toUpperCase()}${pageNumText}`, width / 2, footerY + 9);

  return canvas;
}

/**
 * Exports all pages (or specified page) of the price list as high-resolution PNG
 */
export async function exportPriceListToPng(priceListData, settings, targetPageIndex = null) {
  const { format = "a4", language = "pl" } = settings;
  const labels = priceListData.labels || UI_LABELS[language] || UI_LABELS.pl;
  const pages = priceListData.pages || [];

  if (pages.length === 0) {
    throw new Error("No pages available to export");
  }

  let width = 1240;
  let height = 1754;

  if (format === "stories") {
    width = 1080;
    height = 1920;
  } else if (format === "post") {
    width = 1080;
    height = 1350;
  }

  const exportTargetPages = targetPageIndex
    ? pages.filter((p) => p.pageIndex === targetPageIndex)
    : pages;

  const timestamp = new Date().toISOString().slice(0, 10);
  const downloadedFiles = [];

  for (const page of exportTargetPages) {
    const canvas = renderPageToCanvas(page, settings, labels, width, height);

    await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas toBlob failed"));
          return;
        }
        const pageSuffix = exportTargetPages.length > 1 ? `-page-${page.pageIndex}` : "";
        const filename = `nuar-cennik-${language}-${format}${pageSuffix}-${timestamp}.png`;
        triggerFileDownload(blob, filename);
        downloadedFiles.push(filename);
        setTimeout(resolve, 200); // Small interval between downloads
      }, "image/png");
    });
  }

  return {
    filename: downloadedFiles[0] || "nuar-cennik.png",
    count: downloadedFiles.length,
    files: downloadedFiles,
  };
}

/**
 * Triggers clean print / Save as PDF using the browser's native print engine
 */
export function printPriceList() {
  window.print();
}
