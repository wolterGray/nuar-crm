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

            {/* Categories and Services in Table Layout */}
            <div className="price-content-body">
              {page.categories.map((cat) => {
                const durations = cat.durations || [];
                const hasDurations = durations.length > 0;

                return (
                  <section key={cat.id} className="price-category-block">
                    {/* Category Title with strong contrast and accent line */}
                    <div className="price-cat-header">
                      <h3 className="price-cat-title">{cat.localizedName}</h3>
                      <div className="price-cat-divider" aria-hidden="true" />
                    </div>

                    {/* Clean Table with Duration Columns */}
                    <div className="price-table-wrapper">
                      <table className="price-table">
                        <thead>
                          <tr className="price-table-head-row">
                            <th className="price-th-service">Usługa</th>
                            {hasDurations ? (
                              durations.map((d) => (
                                <th key={d} className="price-th-duration">
                                  {d} min
                                </th>
                              ))
                            ) : (
                              <th className="price-th-duration">Cena</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {cat.services.map((svc) => (
                            <tr key={svc.id} className="price-table-row">
                              <td className="price-td-service">
                                <span className="price-service-name">
                                  {svc.displayName}
                                </span>
                              </td>

                              {hasDurations ? (
                                durations.map((d) => {
                                  const variant = svc.variants?.find(
                                    (v) => v.duration === d
                                  );
                                  return (
                                    <td key={d} className="price-td-price">
                                      {variant ? (
                                        <span className="price-val">
                                          {variant.price} zł
                                        </span>
                                      ) : (
                                        <span className="price-val-dash" aria-label="Brak wariantu">
                                          —
                                        </span>
                                      )}
                                    </td>
                                  );
                                })
                              ) : (
                                <td className="price-td-price">
                                  <span className="price-val">
                                    {svc.price || svc.minPrice} zł
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Document Footer */}
            <DocumentFooter labels={labels} page={page} />
          </article>
        ))}
      </div>
    </div>
  );
}
