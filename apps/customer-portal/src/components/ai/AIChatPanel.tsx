import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { BrainIcon, XIcon, RotateCcwIcon } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatMessageSkeleton } from './ChatMessageSkeleton';
import type { ChatMessage as ChatMessageType } from '@/hooks/useAIChat';

interface AIChatPanelProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
  onClose?: () => void;
  userName?: string;
  title?: string;
  inputPlaceholder?: string;
}

export function AIChatPanel({
  messages,
  isLoading,
  error,
  onSendMessage,
  onClearChat,
  onClose,
  userName,
  title = 'Campaign Assistant',
  inputPlaceholder = 'Ask about your campaign registration...',
}: AIChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary">
            <BrainIcon className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-medium text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearChat}
            title="Clear chat"
            className="h-8 w-8"
          >
            <RotateCcwIcon className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close assistant"
              className="h-8 w-8"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="divide-y">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              userName={userName}
            />
          ))}
          {isLoading && <ChatMessageSkeleton />}
        </div>
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 m-2 rounded">
            {error}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        isLoading={isLoading}
        placeholder={inputPlaceholder}
      />
    </div>
  );
}
