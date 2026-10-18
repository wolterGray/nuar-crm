import AppIcon from "../ui/AppIcon.jsx";

function DocumentHeader({ isFirstPage }) {
  if (!isFirstPage) {
    return (
      <header className="price-doc-header is-compact">
        <div className="price-compact-header-row">
          <span className="price-compact-brand">NUAR</span>
          <span className="price-compact-sep">·</span>
          <span className="price-compact-doc">CENNIK (cd.)</span>
        </div>
        <div className="price-header-divider" aria-hidden="true" />
      </header>
    );
  }

  return (
    <header className="price-doc-header">
      <div className="price-brand-title">NUAR</div>
      <div className="price-doc-title">CENNIK</div>
      <div className="price-brand-subtitle">MASSAGE STUDIO · WARSZAWA</div>
      <div className="price-header-divider" aria-hidden="true" />
    </header>
  );
}

function DocumentFooter({ labels, page }) {
  return (
    <footer className="price-doc-footer">
      <div className="price-footer-divider" aria-hidden="true" />
      <div className="price-footer-content">
        <div className="price-footer-contacts">
          <span>{labels.address}</span>
          <span className="price-footer-bullet">·</span>
          <span>{labels.phone}</span>
          <span className="price-footer-bullet">·</span>
          <span>{labels.website}</span>
        </div>
        {page.totalPages > 1 && (
          <div className="price-footer-pagination">
            Strona {page.pageIndex} z {page.totalPages}
          </div>
        )}
      </div>
    </footer>
  );
}

export default function PriceListPreview({ priceListData }) {
  const { pages = [], labels = {} } = priceListData || {};

  if (!pages || pages.length === 0) {
    return (
      <div className="price-artboard-container">
        <article className="price-sheet-page is-empty">
          <div className="price-empty-notice">
            <AppIcon name="info" size="sm" />
            <span>Brak aktywnych usług do wyświetlenia w cenniku</span>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="price-artboard-container">
      <div className="price-sheets-stack">
        {pages.map((page) => (
          <article
            key={page.pageIndex}
            id={`nuar-printable-price-list-page-${page.pageIndex}`}
            className="price-sheet-page"
            data-page={page.pageIndex}
            aria-label={`Cennik salonu NUAR — Strona ${page.pageIndex} z ${page.totalPages}`}
          >
            {/* Document Header */}
            <DocumentHeader isFirstPage={page.isFirstPage} />

            {/* Categories and Services */}
            <div className="price-content-body">
              {page.categories.map((cat) => (
                <section key={cat.id} className="price-category-block">
                  <div className="price-cat-header">
                    <h3 className="price-cat-title">{cat.localizedName}</h3>
                    <div className="price-cat-divider" aria-hidden="true" />
                  </div>

                  <div className="price-services-list">
                    {cat.services.map((svc) => (
                      <div key={svc.id} className="price-service-row">
                        <div className="price-service-info">
                          <span className="price-service-name">{svc.displayName}</span>
                          {svc.isCombo && (
                            <span className="price-service-badge">Pakiet</span>
                          )}
                        </div>

                        <div className="price-variants-matrix">
                          {svc.variants && svc.variants.length > 0 ? (
                            svc.variants.map((v, i) => (
                              <div key={i} className="price-variant-item">
                                <span className="price-var-duration">
                                  {v.duration} min
                                </span>
                                <span className="price-var-dash">—</span>
                                <span className="price-var-price">
                                  {v.price} zł
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="price-variant-item">
                              <span className="price-var-price">
                                {svc.price || svc.minPrice} zł
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Document Footer */}
            <DocumentFooter labels={labels} page={page} />
          </article>
        ))}
      </div>
    </div>
  );
}
