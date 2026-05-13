import { useState, useRef, useEffect } from 'react';
import MobileLayout from './MobileLayout';
import MobileWrapperPage from './MobileWrapperPage';
import { cn } from '../../utils/cn';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: string;
}

const mockMessages: Message[] = [
  {
    id: '1',
    sender: 'user',
    content: '我的服务器连接不上，能帮忙看看吗？',
    timestamp: '2026-05-08 09:30',
  },
  {
    id: '2',
    sender: 'agent',
    content: '您好，请问您的服务器 ID 或 UUID 是什么？我会帮您查看日志。',
    timestamp: '2026-05-08 09:32',
  },
  {
    id: '3',
    sender: 'user',
    content: 'UUID 是 a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    timestamp: '2026-05-08 09:35',
  },
  {
    id: '4',
    sender: 'agent',
    content: '已收到，正在查看相关日志... 找到了问题，您的服务器端口被防火墙拦截了，我来帮您处理。',
    timestamp: '2026-05-08 09:40',
  },
];

function MessageItem({ msg }: { msg: Message }) {
  return (
    <div
      className={cn('flex', msg.sender === 'user' ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          msg.sender === 'user'
            ? 'bg-zinc-900 text-white rounded-br-sm'
            : 'bg-white text-zinc-900 border border-zinc-200 rounded-bl-sm',
        )}
      >
        <p className="text-sm leading-relaxed">{msg.content}</p>
        <p
          className={cn(
            'text-[10px] mt-1',
            msg.sender === 'user' ? 'text-zinc-400' : 'text-zinc-400',
          )}
        >
          {msg.timestamp}
        </p>
      </div>
    </div>
  );
}

export default function MobileTicketDetail() {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: input.trim(),
      timestamp,
    };
    setMessages((prev) => [...prev, newMessage]);
    setInput('');

    // Simulate agent reply
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        content: '收到您的消息，工作人员正在处理中，请稍等。',
        timestamp,
      };
      setMessages((prev) => [...prev, reply]);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <MobileWrapperPage title="工单详情">
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg) => (
            <MessageItem key={msg.id} msg={msg} />
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              className="flex-1 min-h-[44px] px-4 py-2 rounded-full border border-zinc-200 bg-zinc-50 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-zinc-900 text-white disabled:opacity-40 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </MobileWrapperPage>
  );
}
