import React from 'react';

export class PatientDashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // Optionally log error
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="text-2xl text-red-600 font-bold mb-2">Something went wrong.</div>
          <div className="text-slate-600">Please reload or contact support.</div>
        </div>
      );
    }
    return this.props.children;
  }
}
