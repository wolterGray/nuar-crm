import {Component} from "react";
import {AlertTriangle, RotateCcw} from "lucide-react";

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

  componentDidCatch(error, errorInfo) {
    console.error("CRM ErrorBoundary caught an error", error, errorInfo);
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
