import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Prescripto Application Error Boundary Caught Error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
              !
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h1>
            <p className="text-slate-600 text-sm mb-6">
              The application encountered an unexpected error on startup or rendering. Please refresh the page.
            </p>
            {this.state.error?.message && (
              <div className="bg-red-50 text-red-700 text-xs font-mono p-3 rounded mb-6 text-left overflow-x-auto border border-red-100">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-4 rounded-xl transition duration-200 shadow"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
