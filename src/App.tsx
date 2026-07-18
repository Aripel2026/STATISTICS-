import { useState } from "react";
import { useI18n } from "./i18n";
import CatalogBrowser from "./components/CatalogBrowser";
import CbsBrowser from "./components/CbsBrowser";
import ComparePage from "./components/ComparePage";

type View = "catalog" | "cbs" | "compare";

function App() {
  const { t, locale, setLocale } = useI18n();
  const [view, setView] = useState<View>("catalog");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title-block">
          <h1 className="app-title">{t("appTitle")}</h1>
          <p className="app-subtitle">{t("appSubtitle")}</p>
        </div>
        <nav className="app-nav">
          <button
            type="button"
            className="nav-button"
            aria-current={view === "catalog" ? "page" : undefined}
            onClick={() => setView("catalog")}
          >
            {t("nav.catalog")}
          </button>
          <button
            type="button"
            className="nav-button"
            aria-current={view === "cbs" ? "page" : undefined}
            onClick={() => setView("cbs")}
          >
            {t("nav.cbsBrowser")}
          </button>
          <button
            type="button"
            className="nav-button"
            aria-current={view === "compare" ? "page" : undefined}
            onClick={() => setView("compare")}
          >
            {t("nav.compare")}
          </button>
        </nav>
        <button
          type="button"
          className="lang-toggle"
          onClick={() => setLocale(locale === "he" ? "en" : "he")}
        >
          {t("lang.switch")}
        </button>
      </header>
      <main className="app-main">
        {view === "catalog" && <CatalogBrowser />}
        {view === "cbs" && <CbsBrowser />}
        {view === "compare" && <ComparePage />}
      </main>
      <footer className="app-footer">{t("footer.disclaimer")}</footer>
    </div>
  );
}

export default App;
