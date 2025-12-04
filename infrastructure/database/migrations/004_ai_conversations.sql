-- Migration: Create AI conversations table for learning/review
-- Date: 2025-12-04
-- Feature: Campaign AI Assistant

-- Create ai schema if not exists
CREATE SCHEMA IF NOT EXISTS ai;

-- AI Conversations table
-- Stores conversation history for admin review and learning
CREATE TABLE ai.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL UNIQUE,
    agent_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    messages JSONB NOT NULL,
    form_context JSONB,
    final_form_data JSONB,
    outcome VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT valid_outcome CHECK (outcome IN ('in_progress', 'completed', 'abandoned'))
);

-- Indexes for common queries
CREATE INDEX idx_ai_conversations_session ON ai.conversations(session_id);
CREATE INDEX idx_ai_conversations_user ON ai.conversations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_ai_conversations_agent ON ai.conversations(agent_type);
CREATE INDEX idx_ai_conversations_outcome ON ai.conversations(outcome);
CREATE INDEX idx_ai_conversations_completed ON ai.conversations(completed_at DESC) WHERE outcome = 'completed';

-- Grant permissions
GRANT ALL ON SCHEMA ai TO warp_app;
GRANT ALL ON ALL TABLES IN SCHEMA ai TO warp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ai TO warp_app;

COMMENT ON TABLE ai.conversations IS 'Stores AI assistant conversation history for learning and admin review';
COMMENT ON COLUMN ai.conversations.session_id IS 'Unique session identifier for the conversation';
COMMENT ON COLUMN ai.conversations.agent_type IS 'Type of AI agent (campaign, brand, etc.)';
COMMENT ON COLUMN ai.conversations.messages IS 'Array of conversation messages [{role, content}]';
COMMENT ON COLUMN ai.conversations.form_context IS 'Form values and context at time of conversation';
COMMENT ON COLUMN ai.conversations.final_form_data IS 'Final form data after completion';
COMMENT ON COLUMN ai.conversations.outcome IS 'Conversation outcome: in_progress, completed, or abandoned';
