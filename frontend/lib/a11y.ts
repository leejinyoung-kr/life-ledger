import type { KeyboardEvent } from 'react';

// 클릭 가능한 div 를 키보드 접근 가능하게 만드는 공통 props.
// Enter/Space 로 onClick 과 동일 동작을 트리거하고 role="button"/tabIndex 를 부여한다.
// (네이티브 button 으로 못 바꾸는 카드형 UI 의 a11y 보강용)
export function clickable(onActivate: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
