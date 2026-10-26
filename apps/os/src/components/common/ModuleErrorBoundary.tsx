'use client';

import React from 'react';

type Props = {
  moduleName?: string;
  children: React.ReactNode;
};

type State = { error: Error | null };

/**
 * Catches render errors in a clinical desk module so one suite cannot blank the OS shell.
 */
export class ModuleErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      console.error('[ModuleErrorBoundary]', this.props.moduleName || 'module', error, info.componentStack);
    } catch {
      /* */
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            margin: 24,
            padding: 24,
            borderRadius: 12,
            border: '1px solid #FECACA',
            background: '#FEF2F2',
            color: '#991B1B',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            {this.props.moduleName || 'Module'} failed to load
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>
            {this.state.error.message || 'Unexpected error'}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#DC2626',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
