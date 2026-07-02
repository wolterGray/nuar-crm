export function MobileLayout({children, page}) {
  return (
    <div className="mobile-layout" data-mobile-page={page}>
      {children}
    </div>
  );
}

export function MobilePageContainer({children, page}) {
  return (
    <div className="mobile-page-container" data-mobile-page={page}>
      {children}
    </div>
  );
}
