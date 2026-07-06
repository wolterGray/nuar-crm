import {Component} from "react";
import {AlertTriangle, RotateCcw} from "lucide-react";

const CHUNK_RELOAD_STORAGE_KEY = "nuar-crm:chunk-reload-attempted";

const isChunkLoadError = (error) => {
  const message = String(error?.message ?? error ?? "").toLowerCase();

  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror")
  );
};

const reloadWithFreshAssets = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("crm_reload", String(Date.now()));
  window.location.replace(url.toString());
};

function ErrorFallback({error, onReload, onRetry}) {
  return (
    <section className="app-error-boundary">
      <div className="app-error-boundary-card">
        <span className="app-error-boundary-icon" aria-hidden="true">
          <AlertTriangle size={28} />
        </span>
        <h1>Что-то пошло не так</h1>
        <p>
          CRM столкнулась с неожиданной ошибкой. Можно попробовать восстановить
          экран или перезагрузить страницу.
        </p>
        {error?.message ? (
          <pre className="app-error-boundary-details">{error.message}</pre>
        ) : null}
        <div className="app-error-boundary-actions">
          <button className="secondary-button" type="button" onClick={onRetry}>
            <RotateCcw size={16} />
            Попробовать снова
          </button>
          <button className="add-visit-button" type="button" onClick={onReload}>
            Перезагрузить CRM
          </button>
        </div>
      </div>
    </section>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {error};
  }

  componentDidMount() {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has("crm_reload")) {
      window.sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error("CRM ErrorBoundary caught an error", error, errorInfo);

    if (
      isChunkLoadError(error) &&
      window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) !== "true"
    ) {
      window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, "true");
      reloadWithFreshAssets();
    }
  }

  handleRetry = () => {
    this.setState({error: null});
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReload={this.handleReload}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
