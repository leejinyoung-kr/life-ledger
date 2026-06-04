'use client';

/**
 * AI 챗 페이지.
 * 가계부·자산·구독 데이터를 바탕으로 대화한다. AI 응답은 react-markdown 으로 렌더한다.
 * 현재 응답은 더미(고정 답변)이며, 실제 연동은 TODO. 데이터는 더미.
 * 스타일: Tailwind. 풀높이 채팅(스크롤 영역 + 하단 고정 입력바), 모바일은 하단내비 높이 보정.
 */
import { useEffect, useRef, useState } from 'react';
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

// AI 버블 내부 마크다운 자식 스타일 (p/ul/li/code)
const MD = '[&_p]:m-0 [&_p]:mb-[0.4em] [&_p:last-child]:mb-0 [&_strong]:font-bold [&_ul]:pl-[1.2em] [&_ol]:pl-[1.2em] [&_ul]:my-[0.3em] [&_ol]:my-[0.3em] [&_li]:my-[0.2em] [&_li]:list-disc [&_ol_li]:list-decimal [&_code]:[font-family:var(--font-mono)] [&_code]:text-[0.82rem] [&_code]:bg-elevated [&_code]:rounded-[4px] [&_code]:px-[5px] [&_code]:py-px';

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지 추가 시 항상 맨 아래로 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

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
    <AppShell activePath="/assistant" topbarLabel="AI 챗">
      <div className="flex flex-col h-[calc(100vh-var(--header-h)-64px)] max-md:h-[calc(100vh-var(--header-h)-60px-32px)] max-w-[820px] mx-auto">
        {/* 메시지 스크롤 영역 */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-[18px] px-1 pt-2 pb-5" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 max-w-[80%] max-md:max-w-[88%] ${m.role === 'user' ? 'self-end flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[0.9rem] ${m.role === 'ai' ? 'bg-accent-dim border border-accent' : 'bg-elevated border border-border [font-family:var(--font-display)] font-bold text-[0.75rem] text-secondary'}`}>
                {m.role === 'ai' ? '🤖' : 'K'}
              </div>
              <div className={`px-4 py-3 rounded-[var(--radius-lg)] text-[0.875rem] leading-relaxed ${m.role === 'ai' ? `bg-surface border border-border rounded-tl-[4px] text-primary ${MD}` : 'bg-accent text-white rounded-tr-[4px]'}`}>
                {m.role === 'ai'
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  : m.text}
              </div>
            </div>
          ))}
        </div>

        {/* 추천 칩 + 입력바 */}
        <div>
          <div className="flex gap-2 flex-wrap mb-3">
            {CHIPS.map((c) => (
              <span key={c} className="px-3.5 py-[7px] rounded-full border border-border bg-background text-[0.8rem] text-secondary cursor-pointer transition-all hover:border-accent hover:text-accent hover:bg-accent-dim" onClick={() => send(c)}>{c}</span>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              className="input flex-1 resize-none"
              rows={1}
              placeholder="무엇이든 물어보세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="메시지 입력"
            />
            <button type="button" className="w-[42px] h-[42px] shrink-0 inline-flex items-center justify-center rounded-[var(--radius)] bg-accent text-white transition-all hover:bg-accent-dark" onClick={() => send(input)} aria-label="전송">
              <IconSend width={16} height={16} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
