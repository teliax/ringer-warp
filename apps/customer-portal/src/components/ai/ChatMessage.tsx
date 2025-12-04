import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BrainIcon, UserIcon } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/hooks/useAIChat';

interface ChatMessageProps {
  message: ChatMessageType;
  userName?: string;
}

export function ChatMessage({ message, userName }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex gap-3 p-3',
        isAssistant ? 'bg-muted/50' : 'bg-background'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            isAssistant ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          )}
        >
          {isAssistant ? (
            <BrainIcon className="h-4 w-4" />
          ) : userName ? (
            userName.charAt(0).toUpperCase()
          ) : (
            <UserIcon className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isAssistant ? 'Campaign Assistant' : userName || 'You'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
        {message.formUpdates && message.formUpdates.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground bg-primary/5 rounded px-2 py-1">
            Updated {message.formUpdates.length} field
            {message.formUpdates.length > 1 ? 's' : ''}:{' '}
            {message.formUpdates.map((u) => u.field).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
