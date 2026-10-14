import { useEffect, useState } from 'react';

// 라이트/다크 전환 — html[data-theme] 와 localStorage('theme') 를 맞춘다
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('theme'); } catch { /* 저장소를 못 쓰면 라이트 */ }
    if (saved === 'dark') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage는 클라이언트 마운트 후에만 접근 가능
      setDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* 이번 화면에만 적용 */ }
  };

  return { dark, toggle };
}
