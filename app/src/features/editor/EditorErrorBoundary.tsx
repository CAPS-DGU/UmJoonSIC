import React from 'react';

interface EditorErrorBoundaryProps {
  children: React.ReactNode;
}

interface EditorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class EditorErrorBoundary extends React.Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  constructor(props: EditorErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    // The next render shows the fallback.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log what failed.
    console.error('CodeEditor crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '1rem', color: 'red' }}>
          <h2>에디터에서 오류가 발생했습니다 😢</h2>
          {this.state.error && (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
