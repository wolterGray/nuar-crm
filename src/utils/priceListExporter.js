import { UI_LABELS } from "./priceListTranslations.js";
import { resolveDocumentStyle } from "./priceListGenerator.js";

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
 * Safely loads an image from a URL or data URL
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("Empty image source"));
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Renders a single page of the price list onto a Canvas
 */
async function renderPageToCanvas(page, settings, labels, width, height, effectiveDensity = null) {
  const {
    priceMode = "full",
    showDescriptions = false,
    showContacts = true,
    typographyFamily = "editorial",
    typographyFontSize = "md",
    showLogo = true,
    logoType = "default",
    customLogoUrl,
    logoSize = "md",
    logoAlign = "center",
    bgImage,
    bgImageOpacity = 40,
    bgImageSize = "cover",
  } = settings;

  const density = effectiveDensity || settings.density || "normal";

  // Await web fonts if document.fonts is supported
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (err) {
      console.warn("Fonts ready await warning:", err);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context");
  }

  // Cohesive document style
  const docStyle = resolveDocumentStyle(settings);
  const bg = docStyle.bgColor;
  const textPrimary = docStyle.text;
  const textSecondary = docStyle.muted;
  const textFaint = docStyle.faint;
  const accentRed = docStyle.accent;
  const borderSoft = docStyle.border;
  const dotColor = docStyle.dots;

  // 1. Fill Background Color
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // 2. Optional Background Image with Legibility Overlay
  if (bgImage) {
    try {
      const bgImg = await loadImage(bgImage);
      if (bgImg && bgImg.naturalWidth > 0) {
        if (bgImageSize === "contain") {
          const scale = Math.min(width / bgImg.naturalWidth, height / bgImg.naturalHeight);
          const w = bgImg.naturalWidth * scale;
          const h = bgImg.naturalHeight * scale;
          const x = (width - w) / 2;
          const y = (height - h) / 2;
          ctx.drawImage(bgImg, x, y, w, h);
        } else {
          // cover (default)
          const scale = Math.max(width / bgImg.naturalWidth, height / bgImg.naturalHeight);
          const w = bgImg.naturalWidth * scale;
          const h = bgImg.naturalHeight * scale;
          const x = (width - w) / 2;
          const y = (height - h) / 2;
          ctx.drawImage(bgImg, x, y, w, h);
        }

        // Overlay for legibility
        const overlayColor = docStyle.effectiveTextMode === "light" ? "0, 0, 0" : "255, 255, 255";
        const alpha = Math.max(0, Math.min(1, (bgImageOpacity ?? 40) / 100));
        ctx.fillStyle = `rgba(${overlayColor}, ${alpha})`;
        ctx.fillRect(0, 0, width, height);
      }
    } catch (err) {
      console.warn("Could not load background image for export:", err);
    }
  }

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

  // Typography font selections
  const headingFont =
    typographyFamily === "classic"
      ? "'Playfair Display', Georgia, serif"
      : typographyFamily === "editorial"
        ? "'Playfair Display', Georgia, serif"
        : "Inter, system-ui, -apple-system, sans-serif";

  const bodyFont =
    typographyFamily === "classic"
      ? "Georgia, 'Times New Roman', serif"
      : "Inter, system-ui, -apple-system, sans-serif";

  // Font scale factor
  const fontScale = typographyFontSize === "sm" ? 0.9 : typographyFontSize === "lg" ? 1.12 : 1.0;

  let currentY = margin + (density === "compact" ? 8 : 14);

  // 3. Brand Header
  if (page.isFirstPage) {
    if (showLogo) {
      if (logoType === "custom" && customLogoUrl) {
        try {
          const logoImg = await loadImage(customLogoUrl);
          const maxLogoH = logoSize === "sm" ? 36 : logoSize === "lg" ? 64 : 48;
          const scale = maxLogoH / logoImg.naturalHeight;
          const logoW = logoImg.naturalWidth * scale;
          const logoH = maxLogoH;

          let logoX = (width - logoW) / 2;
          if (logoAlign === "left") logoX = margin;
          if (logoAlign === "right") logoX = width - margin - logoW;

          ctx.drawImage(logoImg, logoX, currentY, logoW, logoH);
          currentY += logoH + 14;
        } catch (err) {
          console.warn("Could not draw custom logo in Canvas:", err);
          // Fallback to text
          ctx.textAlign = logoAlign === "left" ? "left" : logoAlign === "right" ? "right" : "center";
          const textX = logoAlign === "left" ? margin : logoAlign === "right" ? width - margin : width / 2;
          ctx.font = `bold ${Math.round(34 * fontScale)}px ${headingFont}`;
          ctx.fillStyle = textPrimary;
          ctx.letterSpacing = "6px";
          ctx.fillText("N U A R", textX, currentY + 24);
          currentY += 34;
        }
      } else {
        // Text / Default NUAR Mark
        ctx.textAlign = logoAlign === "left" ? "left" : logoAlign === "right" ? "right" : "center";
        const textX = logoAlign === "left" ? margin : logoAlign === "right" ? width - margin : width / 2;

        ctx.font = `bold ${Math.round(36 * fontScale)}px ${headingFont}`;
        ctx.fillStyle = textPrimary;
        ctx.letterSpacing = "6px";
        ctx.fillText("N U A R", textX, currentY + 24);
        currentY += 32;
      }
    }

    ctx.textAlign = "center";
    // Subtitle: "MASSAGE STUDIO · WARSZAWA"
    ctx.font = `600 ${Math.round(11 * fontScale)}px ${bodyFont}`;
    ctx.fillStyle = textSecondary;
    ctx.letterSpacing = "3.2px";
    ctx.fillText(labels.brandSubtitle, width / 2, currentY);
    currentY += 24;

    // Document Title: "CENNIK"
    ctx.font = `700 ${Math.round(15 * fontScale)}px ${bodyFont}`;
    ctx.fillStyle = textPrimary;
    ctx.letterSpacing = "2.5px";
    ctx.fillText(labels.docTitle, width / 2, currentY);
    currentY += 16;

    // Red hairline accent bar
    ctx.fillStyle = accentRed;
    ctx.fillRect(width / 2 - 20, currentY, 40, 2);
    currentY += density === "compact" ? 22 : 30;
  } else {
    // Secondary compact header for subsequent pages
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(17 * fontScale)}px ${headingFont}`;
    ctx.fillStyle = textPrimary;
    ctx.letterSpacing = "3px";
    ctx.fillText(`N U A R   ·   ${labels.docTitle} ${labels.continued}`, width / 2, currentY);
    currentY += 16;

    ctx.fillStyle = accentRed;
    ctx.fillRect(width / 2 - 18, currentY, 36, 1.5);
    currentY += density === "compact" ? 20 : 28;
  }

  // 4. Categories and Services
  ctx.textAlign = "left";
  ctx.letterSpacing = "normal";

  const categories = page.categories || [];
  const maxContentBottom = height - margin - (showContacts ? 60 : 30);

  const catHeaderStep = density === "compact" ? 15 : 19;
  const svcStep = density === "compact" ? 18 : 22;

  for (const cat of categories) {
    if (currentY > maxContentBottom - 40) break;

    // Category Header
    ctx.font = `bold ${Math.round(13 * fontScale)}px ${headingFont}`;
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

    currentY += catHeaderStep;

    // Services list
    for (const service of cat.services) {
      if (currentY > maxContentBottom - 20) break;

      const svcName = service.displayName;
      const variantCount = service.variants?.length || 1;
      const isMultiVariant = priceMode === "full" && variantCount > 1;

      if (isMultiVariant) {
        // Multi-variant Layout: Title on top, horizontal variant capsules underneath
        ctx.font = `600 ${Math.round(13 * fontScale)}px ${bodyFont}`;
        ctx.letterSpacing = "0.2px";
        ctx.fillStyle = textPrimary;
        ctx.fillText(svcName, margin, currentY);
        currentY += 14;

        if (showDescriptions && service.description) {
          ctx.font = `400 ${Math.round(10.5 * fontScale)}px ${bodyFont}`;
          ctx.fillStyle = textSecondary;
          ctx.fillText(service.description.slice(0, 95), margin, currentY);
          currentY += 13;
        }

        // Draw horizontal variant capsules
        const variants = service.variants;
        let pillX = margin;
        const pillH = Math.round(19 * fontScale);

        variants.forEach((v) => {
          const durText = `${v.duration} ${labels.minUnit}`.toUpperCase();
          const priceText = `${v.price} ${labels.currency}`;

          ctx.font = `500 ${Math.round(9.5 * fontScale)}px ${bodyFont}`;
          const durW = ctx.measureText(durText).width;

          ctx.font = `700 ${Math.round(11.5 * fontScale)}px ${bodyFont}`;
          const priceW = ctx.measureText(priceText).width;

          const pillW = durW + priceW + 16;

          // Capsule background
          ctx.fillStyle = docStyle.chipBg;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(pillX, currentY - 11, pillW, pillH, 4);
          } else {
            ctx.rect(pillX, currentY - 11, pillW, pillH);
          }
          ctx.fill();

          ctx.strokeStyle = borderSoft;
          ctx.stroke();

          // Duration text
          ctx.font = `500 ${Math.round(9.5 * fontScale)}px ${bodyFont}`;
          ctx.fillStyle = textFaint;
          ctx.fillText(durText, pillX + 6, currentY + 3);

          // Price text
          ctx.font = `700 ${Math.round(11.5 * fontScale)}px ${bodyFont}`;
          ctx.fillStyle = textPrimary;
          ctx.fillText(priceText, pillX + 6 + durW + 5, currentY + 3);

          pillX += pillW + 6;
        });

        currentY += svcStep;
      } else {
        // Single Variant or Compact Mode: Clean Inline Row
        const priceText =
          priceMode === "compact"
            ? `${labels.fromPrice} ${service.minPrice} ${labels.currency}`
            : service.variants?.[0]
              ? `${service.variants[0].duration} ${labels.minUnit} — ${service.variants[0].price} ${labels.currency}`
              : `${service.price} ${labels.currency}`;

        ctx.font = `600 ${Math.round(13 * fontScale)}px ${bodyFont}`;
        ctx.letterSpacing = "0.2px";
        ctx.fillStyle = textPrimary;
        ctx.fillText(svcName, margin, currentY);

        const nameWidth = ctx.measureText(svcName).width;

        ctx.font = `700 ${Math.round(13 * fontScale)}px ${bodyFont}`;
        ctx.fillStyle = textPrimary;
        const priceWidth = ctx.measureText(priceText).width;

        ctx.textAlign = "right";
        ctx.fillText(priceText, margin + contentWidth, currentY);
        ctx.textAlign = "left";

        // Dot leader
        const dotStartX = margin + nameWidth + 12;
        const dotEndX = margin + contentWidth - priceWidth - 12;

        if (dotEndX > dotStartX) {
          ctx.fillStyle = dotColor;
          const dotSpacing = 8;
          for (let x = dotStartX; x < dotEndX; x += dotSpacing) {
            ctx.fillRect(x, currentY - 3, 1.5, 1.5);
          }
        }

        if (showDescriptions && service.description) {
          currentY += 14;
          ctx.font = `400 ${Math.round(10.5 * fontScale)}px ${bodyFont}`;
          ctx.fillStyle = textSecondary;
          ctx.fillText(service.description.slice(0, 95), margin, currentY);
        }

        currentY += density === "compact" ? 17 : 21;
      }
    }

    currentY += density === "compact" ? 6 : 10;
  }

  // 5. Brand Footer
  if (showContacts) {
    const footerY = height - margin - 14;

    ctx.strokeStyle = borderSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, footerY - 24);
    ctx.lineTo(margin + contentWidth, footerY - 24);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = `500 ${Math.round(11 * fontScale)}px ${bodyFont}`;
    ctx.fillStyle = textSecondary;
    ctx.letterSpacing = "0.5px";

    const contactLine = `${labels.address}   ·   ${labels.phone}   ·   ${labels.website}`;
    ctx.fillText(contactLine, width / 2, footerY - 8);

    ctx.font = `600 ${Math.round(10.5 * fontScale)}px ${bodyFont}`;
    ctx.fillStyle = accentRed;
    ctx.letterSpacing = "1.2px";

    const pageNumText =
      page.totalPages > 1
        ? `   [${labels.pageLabel} ${page.pageIndex} ${labels.ofLabel} ${page.totalPages}]`
        : "";
    ctx.fillText(
      `${labels.onlineBooking.toUpperCase()}: ${labels.website.toUpperCase()}${pageNumText}`,
      width / 2,
      footerY + 9
    );
  }

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

  const effectiveDensity = priceListData.effectiveDensity || settings.density || "normal";

  for (const page of exportTargetPages) {
    const canvas = await renderPageToCanvas(page, settings, labels, width, height, effectiveDensity);

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
