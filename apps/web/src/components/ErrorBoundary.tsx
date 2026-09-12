import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (import.meta.env.DEV) {
      return (
        <div className="fixed inset-0 bg-red-950 text-white p-8 overflow-auto font-mono text-sm z-50">
          <h1 className="text-2xl font-bold mb-4">Unbehandelter Fehler (Dev-Overlay)</h1>
          <pre className="bg-red-900 p-4 rounded mb-4 whitespace-pre-wrap">{error.message}</pre>
          <pre className="bg-red-900 p-4 rounded whitespace-pre-wrap text-xs">{error.stack}</pre>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Ein Fehler ist aufgetreten</h1>
          <p className="text-gray-600">Bitte lade die Seite neu.</p>
        </div>
      </div>
    );
  }
}
