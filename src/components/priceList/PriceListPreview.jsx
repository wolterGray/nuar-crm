import AppIcon from "../ui/AppIcon.jsx";

export default function PriceListPreview({
  priceListData,
  settings,
  scale = 1,
}) {
  const { categories = [], labels = {} } = priceListData;
  const {
    theme = "dark",
    format = "a4",
    priceMode = "full",
    showDescriptions = false,
    showContacts = true,
  } = settings;

  return (
    <div
      className={`price-artboard-container format-${format}`}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top center",
      }}
    >
      <article
        id="nuar-printable-price-list"
        className={`price-sheet theme-${theme} format-${format}`}
        aria-label="Прайс-лист салона NUAR"
      >
        {/* Subtle decorative framing */}
        <div className="price-frame-border" aria-hidden="true">
          <div className="price-corner price-corner-tl" />
          <div className="price-corner price-corner-tr" />
          <div className="price-corner price-corner-bl" />
          <div className="price-corner price-corner-br" />
        </div>

        {/* 1. BRAND HEADER */}
        <header className="price-header">
          <div className="price-logo-mark">
            <span className="price-logo-text">NUAR</span>
            <span className="price-logo-dot" />
          </div>
          <div className="price-brand-subtitle">{labels.brandSubtitle}</div>
          <div className="price-doc-badge">
            <span>{labels.docTitle}</span>
          </div>

          <div className="price-header-divider">
            <span className="price-divider-line" />
            <span className="price-divider-diamond" />
            <span className="price-divider-line" />
          </div>
        </header>

        {/* 2. CATEGORIES AND SERVICES */}
        <div className="price-content-body">
          {categories.length === 0 ? (
            <div className="price-empty-notice">
              <AppIcon name="info" size="sm" />
              <span>Нет выбранных услуг для отображения</span>
            </div>
          ) : (
            categories.map((cat) => (
              <section key={cat.id} className="price-category-block">
                <div className="price-cat-header">
                  <h3 className="price-cat-title">{cat.localizedName}</h3>
                  <div className="price-cat-line" aria-hidden="true" />
                </div>

                <div className="price-services-list">
                  {cat.services.map((svc) => (
                    <div key={svc.id} className="price-service-row">
                      <div className="price-service-main">
                        <div className="price-service-name-wrap">
                          <span className="price-service-name">{svc.displayName}</span>
                          {svc.isCombo ? (
                            <span className="price-tag-badge">{labels.comboBadge}</span>
                          ) : null}
                        </div>

                        {/* Dot leader line connecting name to price */}
                        <div className="price-dot-leader" aria-hidden="true" />

                        {/* Variants or Compact Price */}
                        <div className="price-service-prices">
                          {priceMode === "compact" ? (
                            <div className="price-compact-val">
                              <span className="price-from-label">{labels.fromPrice}</span>
                              <span className="price-amount">{svc.minPrice}</span>
                              <span className="price-currency">{labels.currency}</span>
                            </div>
                          ) : (
                            <div className="price-variants-group">
                              {svc.variants && svc.variants.length > 0 ? (
                                svc.variants.map((v, i) => (
                                  <span key={i} className="price-variant-chip">
                                    <span className="price-var-duration">
                                      {v.duration} {labels.minUnit}
                                    </span>
                                    <span className="price-var-dash">—</span>
                                    <span className="price-var-amount">
                                      {v.price} {labels.currency}
                                    </span>
                                    {i < svc.variants.length - 1 ? (
                                      <span className="price-var-sep">·</span>
                                    ) : null}
                                  </span>
                                ))
                              ) : (
                                <span className="price-variant-chip">
                                  <span className="price-var-amount">
                                    {svc.price || svc.minPrice} {labels.currency}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Optional service description */}
                      {showDescriptions && svc.description ? (
                        <p className="price-service-desc">{svc.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {/* 3. BRAND FOOTER */}
        {showContacts ? (
          <footer className="price-footer">
            <div className="price-footer-line" aria-hidden="true" />
            <div className="price-footer-info">
              <span>{labels.address}</span>
              <span className="price-footer-dot">·</span>
              <span>{labels.phone}</span>
              <span className="price-footer-dot">·</span>
              <span>{labels.instagram}</span>
            </div>
            <div className="price-footer-booking">
              <span className="price-booking-label">{labels.onlineBooking}:</span>
              <span className="price-booking-url">{labels.website}</span>
            </div>
          </footer>
        ) : null}
      </article>
    </div>
  );
}
