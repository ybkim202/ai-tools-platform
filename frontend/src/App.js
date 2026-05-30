import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Link,
} from 'react-router-dom';
import Home from './pages/Home';
import Compare from './pages/Compare';
import Details from './pages/Details';
import Recommendations from './pages/Recommendations';
import { useUIStore } from './stores/toolStore';
import './App.css';

function App() {
  const { theme, toggleDarkMode } = useUIStore();
  const compareCount = useUIStore(
    (state) => state.selectedToolsForCompare.length
  );
  // OS prefers-color-scheme 실시간 추적(시스템 따름 모드에서 아이콘/aria-pressed 갱신용).
  const [systemPrefersDark, setSystemPrefersDark] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    // 3-상태: 'light'/'dark'는 data-theme로 명시, null이면 제거(OS prefers 따름).
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setSystemPrefersDark(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  // 효과적 다크 여부(aria-pressed·아이콘용).
  const isDark = theme === 'dark' || (theme === null && systemPrefersDark);

  return (
    <Router>
      <div className="app">
        {/* 네비게이션 바 */}
        <nav className="navbar">
          <div className="navbar-container">
            <Link to="/" className="navbar-logo">
              <span aria-hidden="true">🤖</span> AITools
            </Link>

            <div className="navbar-menu">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `nav-link${isActive ? ' nav-link-active' : ''}`
                }
              >
                홈
              </NavLink>
              <NavLink
                to="/compare"
                className={({ isActive }) =>
                  `nav-link nav-link-compare${isActive ? ' nav-link-active' : ''}`
                }
              >
                비교
                {compareCount > 0 && (
                  <span
                    className="nav-badge"
                    aria-label={`비교 담긴 도구 ${compareCount}개`}
                  >
                    {compareCount}
                  </span>
                )}
              </NavLink>
              <NavLink
                to="/recommendations"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' nav-link-active' : ''}`
                }
              >
                추천
              </NavLink>
              <button
                type="button"
                className="nav-button"
                onClick={toggleDarkMode}
                aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
                aria-pressed={isDark}
              >
                <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
              </button>
            </div>
          </div>
        </nav>

        {/* 메인 콘텐츠 */}
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/details/:id" element={<Details />} />
          </Routes>
        </main>

        {/* 푸터 */}
        <footer className="footer">
          <div className="footer-content">
            <p>&copy; 2026 AITools. 모든 AI 도구를 한곳에서 비교하고 추천받으세요.</p>
            <div className="footer-links">
              {/* 미연결 항목: 죽은 href 대신 비활성 placeholder로 노출(SR에 '링크'로 오인되지 않도록) */}
              <span className="footer-link-disabled" aria-disabled="true">
                문서
              </span>
              <span className="footer-link-disabled" aria-disabled="true">
                API
              </span>
              <a
                href="https://github.com/ybkim202/ai-tools-platform"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <span className="footer-link-disabled" aria-disabled="true">
                문의
              </span>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
