'use client';

/**
 * AI 챗 페이지.
 * 가계부·자산·구독 데이터를 바탕으로 대화한다. AI 응답은 react-markdown 으로 렌더한다.
 * 현재 응답은 더미(고정 답변)이며, 실제 연동은 TODO. 데이터는 더미.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppShell from '@/components/AppShell';
import { IconSend } from '@/components/icons';

type Role = 'ai' | 'user';
interface Message { role: Role; text: string; }

// 초기 대화 — TODO: GET /api/v1/assistant/history
const INITIAL: Message[] = [
  { role: 'ai', text: '안녕하세요 김관리자님 👋\n\n가계부·자산·구독 데이터를 바탕으로 무엇이든 물어보세요. 예: "이번 달 외식비 얼마야?", "해지하면 좋을 구독 있어?"' },
  { role: 'user', text: '이번 달 쓸 수 있는 돈 얼마나 남았어?' },
  { role: 'ai', text: '5월 기준 **실소비 가용액은 ₩457,700** 입니다.\n\n- 수입 ₩3,200,000\n- 고정지출/구독 ₩384,500\n- 저축이동 ₩500,000\n- 이미 쓴 변동지출 ₩342,300\n\n식비 예산(₩400,000)이 78% 소진돼 외식은 약 ₩88,000 여유가 있습니다.' },
  { role: 'user', text: '구독 중에 정리할 거 있을까?' },
  { role: 'ai', text: '두 건을 추천합니다.\n\n1. **스포티파이 ₩10,900/월** — 최근 42일 미사용\n2. **Disney+** — 6/4 체험 종료, 자동결제 전 해지 시 ₩9,900/월 절약\n\n둘 다 해지하면 **연 ₩250,800**을 아낄 수 있어요.' },
];

// 추천 질문 칩
const CHIPS = [
  '💸 지난달 대비 지출 변화',
  '📊 카테고리별 분석',
  '🎯 저축 목표 진행률',
  '🔁 곧 결제될 구독',
];

export default function AssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 인증 가드 — 토큰 없으면 로그인 페이지로. TODO: 토큰 유효성 검증 API 연동
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      router.replace('/login');
    }
  }, [router]);

  // 새 메시지 추가 시 항상 맨 아래로 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // 로그아웃 — 토큰 제거 후 로그인 페이지로 이동
  function logout() {
    localStorage.removeItem('auth_token');
    router.push('/login');
  }

  // 메시지 전송 — 사용자 메시지 추가 후 더미 AI 응답.
  // TODO: POST /api/v1/assistant (Claude API 스트리밍 응답)
  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: q },
      { role: 'ai', text: '데이터를 분석하고 있어요. (실제 구현 시 Claude API가 가계부·자산·구독 데이터를 참고해 답변합니다.)' },
    ]);
    setInput('');
  }

  // Enter 전송 / Shift+Enter 줄바꿈
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <AppShell activePath="/assistant" topbarLabel="AI 챗" onLogout={logout}>
      <div className="chat-wrap">
        {/* 메시지 스크롤 영역 */}
        <div className="chat-scroll" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className={`msg-avatar ${m.role === 'ai' ? 'ai' : 'me'}`}>{m.role === 'ai' ? '🤖' : 'K'}</div>
              <div className="msg-bubble">
                {m.role === 'ai'
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  : m.text}
              </div>
            </div>
          ))}
        </div>

        {/* 추천 칩 + 입력바 */}
        <div>
          <div className="chips">
            {CHIPS.map((c) => (
              <span key={c} className="chip" onClick={() => send(c)}>{c}</span>
            ))}
          </div>
          <div className="chat-input-bar">
            <textarea
              className="chat-input"
              rows={1}
              placeholder="무엇이든 물어보세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="메시지 입력"
            />
            <button type="button" className="btn btn-primary btn-icon" onClick={() => send(input)} aria-label="전송">
              <IconSend width={16} height={16} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
