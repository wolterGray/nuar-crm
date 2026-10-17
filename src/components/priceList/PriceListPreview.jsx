import AppIcon from "../ui/AppIcon.jsx";

function BrandHeader({ isFirstPage, labels, settings }) {
  const {
    showLogo = true,
    logoType = "default",
    customLogoUrl,
    logoSize = "md",
    logoAlign = "center",
  } = settings;

  if (!isFirstPage) {
    return (
      <header className={`price-header price-header-compact align-${logoAlign}`}>
        <div className="price-compact-header-row">
          {showLogo && logoType === "custom" && customLogoUrl ? (
            <img
              src={customLogoUrl}
              alt="Logo"
              className={`price-compact-custom-logo size-${logoSize}`}
            />
          ) : (
            <span className="price-compact-brand">{labels.brandTitle || "NUAR"}</span>
          )}
          <span className="price-compact-sep">·</span>
          <span className="price-compact-doc">
            {labels.docTitle} {labels.continued}
          </span>
        </div>
        <div className="price-header-accent-bar" aria-hidden="true" />
      </header>
    );
  }

  return (
    <header className={`price-header price-header-main align-${logoAlign}`}>
      {showLogo ? (
        <div className={`price-logo-container align-${logoAlign}`}>
          {logoType === "custom" && customLogoUrl ? (
            <img
              src={customLogoUrl}
              alt={labels.brandTitle || "Logo"}
              className={`price-custom-logo size-${logoSize}`}
            />
          ) : logoType === "text" ? (
            <div className="price-logo-mark">
              <span className="price-logo-text">{labels.brandTitle || "NUAR"}</span>
            </div>
          ) : (
            <div className="price-logo-mark">
              <span className="price-logo-text">{labels.brandTitle || "NUAR"}</span>
              <span className="price-logo-dot" />
            </div>
          )}
        </div>
      ) : null}

      <div className="price-brand-subtitle">{labels.brandSubtitle}</div>
      <h2 className="price-doc-title">{labels.docTitle}</h2>
      <div className="price-header-accent-bar" aria-hidden="true" />
    </header>
  );
}

export default function PriceListPreview({
  priceListData,
  settings,
  scale = 1,
  activePageNumber = null,
}) {
  const { pages = [], labels = {}, style: docStyle = {} } = priceListData;
  const {
    format = "a4",
    priceMode = "full",
    showDescriptions = false,
    showContacts = true,
    typographyFamily = "editorial",
    typographyFontSize = "md",
    typographyHeadingSize = "md",
    density = "normal",
    bgImage,
    bgImageOpacity = 40,
    bgImageSize = "cover",
    bgImagePosition = "center",
  } = settings;

  // If a specific page is selected in tabs, filter to it; otherwise display all pages stacked
  const displayPages = activePageNumber
    ? pages.filter((p) => p.pageIndex === activePageNumber)
    : pages;

  const sheetDynamicStyle = {
    backgroundColor: docStyle.bgColor,
    color: docStyle.text,
    "--price-text": docStyle.text,
    "--price-muted": docStyle.muted,
    "--price-faint": docStyle.faint,
    "--price-border": docStyle.border,
    "--price-dots": docStyle.dots,
    "--price-accent": docStyle.accent,
    "--price-chip-bg": docStyle.chipBg,
  };

  // Use effectiveDensity if calculated by intelligent auto-compaction
  const resolvedDensity = priceListData.effectiveDensity || density || "normal";

  return (
    <div
      className={`price-artboard-container format-${format}`}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top center",
      }}
    >
      <div className="price-sheets-stack">
        {displayPages.length === 0 ? (
          <article
            className={`price-sheet format-${format} font-${typographyFamily} size-${typographyFontSize} density-${resolvedDensity}`}
            style={sheetDynamicStyle}
          >
            <div className="price-empty-notice">
              <AppIcon name="info" size="sm" />
              <span>Нет выбранных услуг для отображения</span>
            </div>
          </article>
        ) : (
          displayPages.map((page) => (
            <article
              key={page.pageIndex}
              id={`nuar-printable-price-list-page-${page.pageIndex}`}
              className={`price-sheet format-${format} font-${typographyFamily} size-${typographyFontSize} heading-${typographyHeadingSize} density-${resolvedDensity} mode-${docStyle.effectiveTextMode || "light"} price-sheet-page`}
              style={sheetDynamicStyle}
              data-page={page.pageIndex}
              aria-label={`Прайс-лист салона NUAR — Страница ${page.pageIndex} из ${page.totalPages}`}
            >
              {/* Optional Background Image with Legibility Overlay */}
              {bgImage ? (
                <div
                  className="price-sheet-bg-layer"
                  aria-hidden="true"
                  style={{
                    backgroundImage: `url(${bgImage})`,
                    backgroundSize: bgImageSize || "cover",
                    backgroundPosition: bgImagePosition || "center",
                    backgroundRepeat: bgImageSize === "repeat" ? "repeat" : "no-repeat",
                  }}
                >
                  <div
                    className="price-sheet-bg-overlay"
                    style={{
                      backgroundColor:
                        docStyle.effectiveTextMode === "light" ? "#000000" : "#ffffff",
                      opacity: (bgImageOpacity ?? 40) / 100,
                    }}
                  />
                </div>
              ) : null}

              {/* Subtle architectural frame */}
              <div className="price-frame-border" aria-hidden="true">
                <div className="price-corner price-corner-tl" />
                <div className="price-corner price-corner-tr" />
                <div className="price-corner price-corner-bl" />
                <div className="price-corner price-corner-br" />
              </div>

              {/* 1. BRAND HEADER */}
              <BrandHeader
                isFirstPage={page.isFirstPage}
                labels={labels}
                settings={settings}
                page={page}
              />

              {/* 2. CATEGORIES AND SERVICES */}
              <div className="price-content-body">
                {page.categories.map((cat) => (
                  <section key={cat.id} className="price-category-block">
                    <div className="price-cat-header">
                      <h3 className="price-cat-title">{cat.localizedName}</h3>
                      <div className="price-cat-line" aria-hidden="true" />
                    </div>

                    <div className="price-services-list">
                      {cat.services.map((svc) => {
                        const variantCount = svc.variants?.length || 1;
                        const isMultiVariant = priceMode === "full" && variantCount > 1;

                        return (
                          <div
                            key={svc.id}
                            className={`price-service-row ${
                              isMultiVariant ? "is-multi-variant" : "is-single-variant"
                            }`}
                          >
                            {isMultiVariant ? (
                              /* Multiple variants: Hero Title + Structured Grid */
                              <div className="price-service-matrix-layout">
                                <div className="price-service-name-wrap">
                                  <span className="price-service-name">{svc.displayName}</span>
                                  {svc.isCombo ? (
                                    <span className="price-tag-badge">{labels.comboBadge}</span>
                                  ) : null}
                                </div>

                                {showDescriptions && svc.description ? (
                                  <p className="price-service-desc">{svc.description}</p>
                                ) : null}

                                <div className="price-variant-grid">
                                  {svc.variants.map((v, i) => (
                                    <div key={i} className="price-variant-col">
                                      <span className="price-var-duration">
                                        {v.duration} {labels.minUnit}
                                      </span>
                                      <span className="price-var-price">
                                        {v.price} {labels.currency}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              /* Single variant or Compact Mode: Clean Inline Row */
                              <div className="price-service-inline-layout">
                                <div className="price-service-name-wrap">
                                  <span className="price-service-name">{svc.displayName}</span>
                                  {svc.isCombo ? (
                                    <span className="price-tag-badge">{labels.comboBadge}</span>
                                  ) : null}
                                </div>

                                <div className="price-dot-leader" aria-hidden="true" />

                                <div className="price-service-prices">
                                  {priceMode === "compact" ? (
                                    <div className="price-compact-val">
                                      <span className="price-from-label">{labels.fromPrice}</span>
                                      <span className="price-amount">{svc.minPrice}</span>
                                      <span className="price-currency">{labels.currency}</span>
                                    </div>
                                  ) : (
                                    <div className="price-single-val">
                                      {svc.variants?.[0]?.duration ? (
                                        <span className="price-var-duration-inline">
                                          {svc.variants[0].duration} {labels.minUnit}
                                        </span>
                                      ) : null}
                                      <span className="price-amount">
                                        {svc.variants?.[0]?.price || svc.price || svc.minPrice}
                                      </span>
                                      <span className="price-currency">{labels.currency}</span>
                                    </div>
                                  )}
                                </div>

                                {showDescriptions && svc.description ? (
                                  <p className="price-service-desc">{svc.description}</p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {/* 3. BRAND FOOTER */}
              {showContacts ? (
                <footer className="price-footer">
                  <div className="price-footer-line" aria-hidden="true" />
                  <div className="price-footer-main">
                    <div className="price-footer-info">
                      <span>{labels.address}</span>
                      <span className="price-footer-dot">·</span>
                      <span>{labels.phone}</span>
                      <span className="price-footer-dot">·</span>
                      <span>{labels.website}</span>
                    </div>

                    <div className="price-footer-booking">
                      <span className="price-booking-label">{labels.onlineBooking}:</span>
                      <span className="price-booking-url">{labels.website}</span>
                    </div>

                    {page.totalPages > 1 ? (
                      <div className="price-footer-page-num">
                        {labels.pageLabel} {page.pageIndex} {labels.ofLabel} {page.totalPages}
                      </div>
                    ) : null}
                  </div>
                </footer>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
