import { useI18n } from "./i18n";
import Dashboard from "./components/Dashboard";

function App() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title-block">
          <h1 className="app-title">{t("appTitle")}</h1>
          <p className="app-subtitle">{t("appSubtitle")}</p>
        </div>
        <button
          type="button"
          className="lang-toggle"
          onClick={() => setLocale(locale === "he" ? "en" : "he")}
        >
          {t("lang.switch")}
        </button>
      </header>
      <main className="app-main">
        <Dashboard />
      </main>
      <footer className="app-footer">{t("footer.disclaimer")}</footer>
    </div>
  );
}

export default App;
