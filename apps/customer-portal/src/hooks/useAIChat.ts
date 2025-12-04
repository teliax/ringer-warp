import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  formUpdates?: FormFieldUpdate[];
}

export interface FormFieldUpdate {
  field: string;
  value: unknown;
}

interface AIChatRequest {
  agent_type: string;
  messages: Array<{ role: string; content: string }>;
  context?: Record<string, unknown>;
  session_id?: string;
}

interface AIChatResponse {
  message: string;
  form_updates?: FormFieldUpdate[];
  session_id: string;
}

interface UseAIChatOptions {
  agentType: string;
  context?: Record<string, unknown>;
  onFormUpdate?: (field: string, value: unknown) => void;
  initialMessage?: string;
}

export function useAIChat(options: UseAIChatOptions) {
  const { agentType, context, onFormUpdate, initialMessage } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const contextRef = useRef(context);

  // Update context ref when it changes
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  // Add initial assistant message on mount
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      setMessages([{
        id: uuidv4(),
        role: 'assistant',
        content: initialMessage,
        timestamp: new Date(),
      }]);
    }
  }, [initialMessage, messages.length]);

  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim() || isLoading) return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Build message history for API (exclude initial greeting from assistant)
      const messageHistory = [...messages, userMessage]
        .filter(m => m.role === 'user' || messages.indexOf(m) > 0) // Keep user messages and non-initial assistant messages
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const request: AIChatRequest = {
        agent_type: agentType,
        messages: messageHistory,
        context: contextRef.current,
        session_id: sessionId || undefined,
      };

      const response = await axios.post<{ data: AIChatResponse }>(
        '/v1/ai/chat',
        request
      );

      const data = response.data.data || response.data;

      // Update session ID
      if (data.session_id) {
        setSessionId(data.session_id);
      }

      // Add assistant response to chat
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        formUpdates: data.form_updates,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Apply form updates
      if (data.form_updates && onFormUpdate) {
        for (const update of data.form_updates) {
          onFormUpdate(update.field, update.value);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to get AI response';
      setError(errorMessage);

      // Add error message to chat
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [agentType, isLoading, messages, onFormUpdate, sessionId]);

  const clearChat = useCallback(() => {
    setMessages(initialMessage ? [{
      id: uuidv4(),
      role: 'assistant',
      content: initialMessage,
      timestamp: new Date(),
    }] : []);
    setSessionId(null);
    setError(null);
  }, [initialMessage]);

  const completeConversation = useCallback(async (finalFormData: Record<string, unknown>) => {
    if (!sessionId) return;

    try {
      await axios.post(`/v1/ai/conversations/${sessionId}/complete`, finalFormData);
    } catch (err) {
      console.error('Failed to complete conversation:', err);
    }
  }, [sessionId]);

  return {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    clearChat,
    completeConversation,
  };
}
