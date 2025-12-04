package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AIConversationRepository handles database operations for AI conversations
type AIConversationRepository struct {
	db *pgxpool.Pool
}

// NewAIConversationRepository creates a new AI conversation repository
func NewAIConversationRepository(db *pgxpool.Pool) *AIConversationRepository {
	return &AIConversationRepository{db: db}
}

// AIConversation represents a conversation stored in the database
type AIConversation struct {
	ID            uuid.UUID              `db:"id"`
	SessionID     uuid.UUID              `db:"session_id"`
	AgentType     string                 `db:"agent_type"`
	UserID        *uuid.UUID             `db:"user_id"`
	Messages      interface{}            `db:"messages"`
	FormContext   map[string]interface{} `db:"form_context"`
	FinalFormData map[string]interface{} `db:"final_form_data"`
	Outcome       string                 `db:"outcome"` // "in_progress", "completed", "abandoned"
	CreatedAt     time.Time              `db:"created_at"`
	CompletedAt   *time.Time             `db:"completed_at"`
}

// StoreConversation stores or updates a conversation in the database
func (r *AIConversationRepository) StoreConversation(ctx context.Context, conv *AIConversation) error {
	messagesJSON, err := json.Marshal(conv.Messages)
	if err != nil {
		return fmt.Errorf("failed to marshal messages: %w", err)
	}

	var formContextJSON []byte
	if conv.FormContext != nil {
		formContextJSON, err = json.Marshal(conv.FormContext)
		if err != nil {
			return fmt.Errorf("failed to marshal form context: %w", err)
		}
	}

	// Upsert - update if session exists, insert if new
	query := `
		INSERT INTO ai.conversations (
			session_id,
			agent_type,
			user_id,
			messages,
			form_context,
			outcome
		) VALUES ($1, $2, $3, $4, $5, 'in_progress')
		ON CONFLICT (session_id) DO UPDATE SET
			messages = $4,
			form_context = $5
		RETURNING id, created_at
	`

	err = r.db.QueryRow(ctx, query,
		conv.SessionID,
		conv.AgentType,
		conv.UserID,
		messagesJSON,
		formContextJSON,
	).Scan(&conv.ID, &conv.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to store conversation: %w", err)
	}

	return nil
}

// CompleteConversation marks a conversation as completed with final form data
func (r *AIConversationRepository) CompleteConversation(ctx context.Context, sessionID uuid.UUID, finalFormData map[string]interface{}) error {
	finalFormDataJSON, err := json.Marshal(finalFormData)
	if err != nil {
		return fmt.Errorf("failed to marshal final form data: %w", err)
	}

	query := `
		UPDATE ai.conversations
		SET outcome = 'completed',
		    final_form_data = $2,
		    completed_at = NOW()
		WHERE session_id = $1
	`

	result, err := r.db.Exec(ctx, query, sessionID, finalFormDataJSON)
	if err != nil {
		return fmt.Errorf("failed to complete conversation: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("conversation not found: %s", sessionID)
	}

	return nil
}

// GetConversation retrieves a conversation by session ID
func (r *AIConversationRepository) GetConversation(ctx context.Context, sessionID uuid.UUID) (*AIConversation, error) {
	query := `
		SELECT
			id,
			session_id,
			agent_type,
			user_id,
			messages,
			form_context,
			final_form_data,
			outcome,
			created_at,
			completed_at
		FROM ai.conversations
		WHERE session_id = $1
	`

	var conv AIConversation
	var messagesJSON, formContextJSON, finalFormDataJSON []byte

	err := r.db.QueryRow(ctx, query, sessionID).Scan(
		&conv.ID,
		&conv.SessionID,
		&conv.AgentType,
		&conv.UserID,
		&messagesJSON,
		&formContextJSON,
		&finalFormDataJSON,
		&conv.Outcome,
		&conv.CreatedAt,
		&conv.CompletedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}

	// Unmarshal JSON fields
	if err := json.Unmarshal(messagesJSON, &conv.Messages); err != nil {
		return nil, fmt.Errorf("failed to unmarshal messages: %w", err)
	}

	if formContextJSON != nil {
		if err := json.Unmarshal(formContextJSON, &conv.FormContext); err != nil {
			return nil, fmt.Errorf("failed to unmarshal form context: %w", err)
		}
	}

	if finalFormDataJSON != nil {
		if err := json.Unmarshal(finalFormDataJSON, &conv.FinalFormData); err != nil {
			return nil, fmt.Errorf("failed to unmarshal final form data: %w", err)
		}
	}

	return &conv, nil
}

// ListCompletedConversations returns completed conversations for admin review
func (r *AIConversationRepository) ListCompletedConversations(ctx context.Context, agentType string, limit int) ([]AIConversation, error) {
	query := `
		SELECT
			id,
			session_id,
			agent_type,
			user_id,
			messages,
			form_context,
			final_form_data,
			outcome,
			created_at,
			completed_at
		FROM ai.conversations
		WHERE outcome = 'completed'
		AND ($1 = '' OR agent_type = $1)
		ORDER BY completed_at DESC
		LIMIT $2
	`

	rows, err := r.db.Query(ctx, query, agentType, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list conversations: %w", err)
	}
	defer rows.Close()

	var conversations []AIConversation
	for rows.Next() {
		var conv AIConversation
		var messagesJSON, formContextJSON, finalFormDataJSON []byte

		err := rows.Scan(
			&conv.ID,
			&conv.SessionID,
			&conv.AgentType,
			&conv.UserID,
			&messagesJSON,
			&formContextJSON,
			&finalFormDataJSON,
			&conv.Outcome,
			&conv.CreatedAt,
			&conv.CompletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan conversation: %w", err)
		}

		// Unmarshal JSON fields
		json.Unmarshal(messagesJSON, &conv.Messages)
		if formContextJSON != nil {
			json.Unmarshal(formContextJSON, &conv.FormContext)
		}
		if finalFormDataJSON != nil {
			json.Unmarshal(finalFormDataJSON, &conv.FinalFormData)
		}

		conversations = append(conversations, conv)
	}

	return conversations, rows.Err()
}

// MarkAbandoned marks stale conversations as abandoned (cleanup job)
func (r *AIConversationRepository) MarkAbandoned(ctx context.Context, olderThan time.Duration) (int64, error) {
	query := `
		UPDATE ai.conversations
		SET outcome = 'abandoned'
		WHERE outcome = 'in_progress'
		AND created_at < NOW() - $1::interval
	`

	result, err := r.db.Exec(ctx, query, olderThan.String())
	if err != nil {
		return 0, fmt.Errorf("failed to mark abandoned conversations: %w", err)
	}

	return result.RowsAffected(), nil
}
