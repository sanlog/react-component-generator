import { useState, useEffect } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { Window } from './components/Window';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import type { Provider } from './types';
import {
  STORAGE_KEYS,
  addPromptToHistory,
  loadHistory,
  loadProvider,
  saveJSON,
} from './utils/storage';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

function App() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<Provider>(loadProvider);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const { components, streamingComponent, isLoading, error, generate, removeComponent, clearAll } =
    useComponentGenerator();
  const visibleComponents = streamingComponent ? [streamingComponent, ...components] : components;

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.provider, provider);
  }, [provider]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.history, history);
  }, [history]);

  const hasEnvKey = envKeys[provider];

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      alert(`${PROVIDER_CONFIG[provider].label} API 키를 입력하거나 .env에 설정해주세요.`);
      return;
    }
    setHistory((prev) => addPromptToHistory(prev, prompt));
    generate(prompt, apiKey || undefined, provider);
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    setApiKey('');
  };

  const activeProvider = PROVIDER_CONFIG[provider].label;

  return (
    <div className="app">
      <div className="menubar">
        <div className="menubar-brand">
          <span className="brand-mark" aria-hidden="true">
            RC
          </span>
          <span>React 컴포넌트 생성기</span>
        </div>
        <div className="menubar-tray" aria-label="현재 작업 상태">
          <span className="tray-item">모델 {activeProvider}</span>
          <span className="tray-item">컴포넌트 {components.length}개</span>
        </div>
      </div>

      <header className="hero">
        <h1>프롬프트로 만드는 UI 워크벤치</h1>
        <p>요청을 입력하면 React 컴포넌트를 만들어 바로 미리보고, 코드로 확인할 수 있어요.</p>
      </header>

      <main className="workspace">
        <Window title="프롬프트" className="composer-panel">
          <PromptInput onGenerate={handleGenerate} isLoading={isLoading} history={history} />
        </Window>

        <Window title="실행 설정" className="settings-panel">
          <div className="provider-select">
            <label htmlFor="provider">모델 제공사</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
            >
              {Object.entries(PROVIDER_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="api-key-input">
            <label htmlFor="api-key">API 키</label>
            <div className="api-key-field">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  hasEnvKey
                    ? '서버 키 사용 중 (직접 입력으로 덮어쓰기 가능)'
                    : PROVIDER_CONFIG[provider].placeholder
                }
              />
              <button
                className="btn-toggle-key"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? '숨기기' : '보기'}
              </button>
            </div>
            <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
              {hasEnvKey
                ? '.env 키가 연결되어 있습니다.'
                : '직접 입력하거나 서버 환경변수를 설정하세요.'}
            </p>
          </div>
        </Window>
      </main>

      {error && (
        <div className="error-banner" role="alert">
          <p>{error}</p>
        </div>
      )}

      <section className="results-section" aria-label="생성 결과">
        {visibleComponents.length > 0 && (
          <div className="results-header">
            <h2>생성된 컴포넌트</h2>
            <button className="btn-clear" onClick={clearAll}>
              전체 삭제
            </button>
          </div>
        )}

        {components.length === 0 && !isLoading && (
          <Window title="새 컴포넌트" className="empty-state">
            <div className="empty-inner">
              <div className="empty-canvas" aria-hidden="true">
                <div className="empty-block empty-block--accent" />
                <div className="empty-block" />
                <div className="empty-block empty-block--wide" />
              </div>
              <div className="empty-copy">
                <h3>새 컴포넌트를 생성해보세요.</h3>
                <p>만들고 싶은 UI를 위에 적으면 미리보기와 코드가 여기에 나타납니다.</p>
              </div>
            </div>
          </Window>
        )}

        {isLoading && !streamingComponent && (
          <Window title="생성 중" className="loading-card">
            <div className="loading-inner" role="status">
              <p>컴포넌트를 생성하고 있습니다...</p>
              <div className="progress" aria-hidden="true">
                <span />
              </div>
            </div>
          </Window>
        )}

        <div className="results-grid">
          {visibleComponents.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onRemove={removeComponent}
              onRegenerate={handleGenerate}
              isLoading={isLoading}
              isStreaming={component.id === streamingComponent?.id}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
