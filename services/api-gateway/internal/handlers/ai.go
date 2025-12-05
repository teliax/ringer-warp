package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ringer-warp/api-gateway/internal/ai"
	"github.com/ringer-warp/api-gateway/internal/claude"
	"github.com/ringer-warp/api-gateway/internal/repository"
	"go.uber.org/zap"
)

// AIHandler handles AI chat endpoints
type AIHandler struct {
	claudeClient *claude.Client
	convRepo     *repository.AIConversationRepository
	logger       *zap.Logger
}

// NewAIHandler creates a new AI handler
func NewAIHandler(
	claudeClient *claude.Client,
	convRepo *repository.AIConversationRepository,
	logger *zap.Logger,
) *AIHandler {
	return &AIHandler{
		claudeClient: claudeClient,
		convRepo:     convRepo,
		logger:       logger,
	}
}

// ChatMessage represents a message in the chat
type ChatMessage struct {
	Role    string `json:"role"` // "user" or "assistant"
	Content string `json:"content"`
}

// AIChatRequest represents a request to the AI chat endpoint
type AIChatRequest struct {
	AgentType string                 `json:"agent_type" binding:"required"` // "campaign", "brand", etc.
	Messages  []ChatMessage          `json:"messages" binding:"required"`
	Context   map[string]interface{} `json:"context,omitempty"` // Form values, brand info, etc.
	SessionID string                 `json:"session_id,omitempty"`
}

// AIChatResponse represents the response from the AI chat endpoint
type AIChatResponse struct {
	Message     string                   `json:"message"`
	FormUpdates []ai.FormFieldUpdate     `json:"form_updates,omitempty"`
	SessionID   string                   `json:"session_id"`
}

// Chat godoc
// @Summary Chat with AI assistant
// @Description Send a message to the AI assistant and receive a response with optional form field updates
// @Tags AI
// @Accept json
// @Produce json
// @Param request body AIChatRequest true "Chat request"
// @Success 200 {object} AIChatResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/ai/chat [post]
func (h *AIHandler) Chat(c *gin.Context) {
	var req AIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Validate agent type
	agentConfig := ai.GetAgentConfig(ai.AgentType(req.AgentType))
	if agentConfig == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown agent type: " + req.AgentType})
		return
	}

	// Get or create session ID
	sessionID := req.SessionID
	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	// Get user ID from context (set by JWT middleware)
	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)

	// Convert messages to Claude format
	claudeMessages := make([]claude.Message, len(req.Messages))
	for i, msg := range req.Messages {
		claudeMessages[i] = claude.NewTextMessage(msg.Role, msg.Content)
	}

	// Build system prompt with context
	systemPrompt := agentConfig.SystemPrompt
	if req.Context != nil {
		// Add context information to system prompt
		contextJSON, _ := json.Marshal(req.Context)
		systemPrompt += "\n\n## Current Form Context\n```json\n" + string(contextJSON) + "\n```"
	}

	// Accumulate all responses across the tool use loop
	var allTextContent []string
	var allFormUpdates []ai.FormFieldUpdate
	var totalInputTokens, totalOutputTokens int

	// Maximum iterations to prevent infinite loops
	const maxIterations = 10

	for iteration := 0; iteration < maxIterations; iteration++ {
		// Create Claude chat request
		chatReq := &claude.ChatRequest{
			Model:     agentConfig.Model,
			Messages:  claudeMessages,
			System:    systemPrompt,
			MaxTokens: agentConfig.MaxTokens,
			Tools:     agentConfig.Tools,
		}

		// Call Claude API
		resp, err := h.claudeClient.Chat(c.Request.Context(), chatReq)
		if err != nil {
			h.logger.Error("Failed to call Claude API",
				zap.Error(err),
				zap.String("session_id", sessionID),
				zap.String("agent_type", req.AgentType),
				zap.Int("iteration", iteration),
			)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service temporarily unavailable"})
			return
		}

		// Track token usage
		totalInputTokens += resp.Usage.InputTokens
		totalOutputTokens += resp.Usage.OutputTokens

		// Extract text content from this response
		textContent := resp.GetTextContent()
		if textContent != "" {
			allTextContent = append(allTextContent, textContent)
		}

		// Extract form updates from tool use
		toolUses := resp.GetToolUses()
		for _, toolUse := range toolUses {
			if toolUse.Name == "update_form_fields" {
				// Parse the tool input to get form updates
				if updates, ok := toolUse.Input["updates"].([]interface{}); ok {
					for _, update := range updates {
						if updateMap, ok := update.(map[string]interface{}); ok {
							field, _ := updateMap["field"].(string)
							value := updateMap["value"]
							if field != "" {
								allFormUpdates = append(allFormUpdates, ai.FormFieldUpdate{
									Field: field,
									Value: value,
								})
							}
						}
					}
				}
			}
		}

		// Check if Claude wants to continue (stop_reason: "tool_use" means more processing needed)
		if resp.StopReason != "tool_use" {
			// Claude is done - either "end_turn" or other stop reason
			h.logger.Debug("Claude finished responding",
				zap.String("stop_reason", resp.StopReason),
				zap.Int("iterations", iteration+1),
			)
			break
		}

		// Claude called tools and expects results - continue the conversation
		h.logger.Debug("Claude called tools, continuing conversation",
			zap.Int("tool_calls", len(toolUses)),
			zap.Int("iteration", iteration),
		)

		// Add the assistant's response (with tool calls) to the conversation
		claudeMessages = append(claudeMessages, claude.NewAssistantMessageWithToolUse(resp))

		// Create tool results for each tool call
		var toolResults []claude.ToolResultContent
		for _, toolUse := range toolUses {
			// For update_form_fields, we acknowledge the update was successful
			toolResults = append(toolResults, claude.ToolResultContent{
				Type:      "tool_result",
				ToolUseID: toolUse.ID,
				Content:   "Form fields updated successfully.",
			})
		}

		// Add tool results as a user message
		claudeMessages = append(claudeMessages, claude.NewToolResultMessage(toolResults))
	}

	// Combine all text content
	finalMessage := ""
	for i, text := range allTextContent {
		if i > 0 {
			finalMessage += "\n\n"
		}
		finalMessage += text
	}

	// Store conversation in database (for learning/review)
	if h.convRepo != nil {
		go func() {
			// Store asynchronously to not block the response
			conv := &repository.AIConversation{
				SessionID:   uuid.MustParse(sessionID),
				AgentType:   req.AgentType,
				Messages:    req.Messages,
				FormContext: req.Context,
			}
			if userIDStr != "" {
				uid, _ := uuid.Parse(userIDStr)
				conv.UserID = &uid
			}
			if err := h.convRepo.StoreConversation(context.Background(), conv); err != nil {
				h.logger.Error("Failed to store conversation",
					zap.Error(err),
					zap.String("session_id", sessionID),
				)
			}
		}()
	}

	h.logger.Info("AI chat completed",
		zap.String("session_id", sessionID),
		zap.String("agent_type", req.AgentType),
		zap.Int("form_updates", len(allFormUpdates)),
		zap.Int("input_tokens", totalInputTokens),
		zap.Int("output_tokens", totalOutputTokens),
	)

	c.JSON(http.StatusOK, AIChatResponse{
		Message:     finalMessage,
		FormUpdates: allFormUpdates,
		SessionID:   sessionID,
	})
}

// CompleteConversation godoc
// @Summary Mark a conversation as completed
// @Description Store the final form data and mark the conversation as completed
// @Tags AI
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Param request body map[string]interface{} true "Final form data"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /v1/ai/conversations/{session_id}/complete [post]
func (h *AIHandler) CompleteConversation(c *gin.Context) {
	sessionID := c.Param("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Session ID required"})
		return
	}

	var finalFormData map[string]interface{}
	if err := c.ShouldBindJSON(&finalFormData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	if h.convRepo != nil {
		sessionUUID, err := uuid.Parse(sessionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session ID"})
			return
		}

		if err := h.convRepo.CompleteConversation(c.Request.Context(), sessionUUID, finalFormData); err != nil {
			h.logger.Error("Failed to complete conversation",
				zap.Error(err),
				zap.String("session_id", sessionID),
			)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete conversation"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":     "completed",
		"session_id": sessionID,
	})
}
