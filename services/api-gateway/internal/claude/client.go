// Package claude provides a client for the Anthropic Claude API
package claude

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

const (
	AnthropicAPIBaseURL = "https://api.anthropic.com/v1"
	DefaultModel        = "claude-3-haiku-20240307"
	DefaultMaxTokens    = 4096
	APIVersion          = "2023-06-01"
)

// Client wraps the Anthropic Claude API
type Client struct {
	apiKey     string
	httpClient *http.Client
	logger     *zap.Logger
}

// NewClient creates a new Claude API client
func NewClient(apiKey string, logger *zap.Logger) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // Longer timeout for AI responses
		},
		logger: logger,
	}
}

// Message represents a conversation message
// Content can be a string or array of content blocks (for tool use)
type Message struct {
	Role    string      `json:"role"` // "user" or "assistant"
	Content interface{} `json:"content"`
}

// ToolResultContent represents a tool result content block
type ToolResultContent struct {
	Type      string `json:"type"`                 // "tool_result"
	ToolUseID string `json:"tool_use_id"`
	Content   string `json:"content"`
}

// NewTextMessage creates a message with string content
func NewTextMessage(role, content string) Message {
	return Message{Role: role, Content: content}
}

// NewToolResultMessage creates a user message with tool results
func NewToolResultMessage(results []ToolResultContent) Message {
	// Convert to interface slice for JSON marshaling
	content := make([]interface{}, len(results))
	for i, r := range results {
		content[i] = r
	}
	return Message{Role: "user", Content: content}
}

// NewAssistantMessageWithToolUse creates an assistant message from a response with tool use
func NewAssistantMessageWithToolUse(resp *ChatResponse) Message {
	// Convert content blocks to interface slice
	content := make([]interface{}, len(resp.Content))
	for i, block := range resp.Content {
		if block.Type == "text" {
			content[i] = map[string]interface{}{
				"type": "text",
				"text": block.Text,
			}
		} else if block.Type == "tool_use" {
			content[i] = map[string]interface{}{
				"type":  "tool_use",
				"id":    block.ID,
				"name":  block.Name,
				"input": block.Input,
			}
		}
	}
	return Message{Role: "assistant", Content: content}
}

// Tool represents a tool/function the model can call
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

// ToolUse represents a tool call from the model
type ToolUse struct {
	Type  string                 `json:"type"` // "tool_use"
	ID    string                 `json:"id"`
	Name  string                 `json:"name"`
	Input map[string]interface{} `json:"input"`
}

// ContentBlock represents content in a response
type ContentBlock struct {
	Type  string `json:"type"` // "text" or "tool_use"
	Text  string `json:"text,omitempty"`
	ID    string `json:"id,omitempty"`
	Name  string `json:"name,omitempty"`
	Input map[string]interface{} `json:"input,omitempty"`
}

// ChatRequest represents a request to the messages API
type ChatRequest struct {
	Model     string    `json:"model"`
	Messages  []Message `json:"messages"`
	System    string    `json:"system,omitempty"`
	MaxTokens int       `json:"max_tokens"`
	Stream    bool      `json:"stream,omitempty"`
	Tools     []Tool    `json:"tools,omitempty"`
}

// ChatResponse represents a response from the messages API
type ChatResponse struct {
	ID           string         `json:"id"`
	Type         string         `json:"type"`
	Role         string         `json:"role"`
	Content      []ContentBlock `json:"content"`
	Model        string         `json:"model"`
	StopReason   string         `json:"stop_reason"`
	StopSequence *string        `json:"stop_sequence,omitempty"`
	Usage        struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

// GetTextContent extracts the text content from the response
func (r *ChatResponse) GetTextContent() string {
	for _, block := range r.Content {
		if block.Type == "text" {
			return block.Text
		}
	}
	return ""
}

// GetToolUses extracts tool use blocks from the response
func (r *ChatResponse) GetToolUses() []ContentBlock {
	var tools []ContentBlock
	for _, block := range r.Content {
		if block.Type == "tool_use" {
			tools = append(tools, block)
		}
	}
	return tools
}

// StreamEvent represents an event from the streaming API
type StreamEvent struct {
	Type  string `json:"type"`
	Index int    `json:"index,omitempty"`
	Delta struct {
		Type string `json:"type,omitempty"`
		Text string `json:"text,omitempty"`
	} `json:"delta,omitempty"`
	ContentBlock *ContentBlock `json:"content_block,omitempty"`
	Message      *ChatResponse `json:"message,omitempty"`
	Error        *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Chat sends a non-streaming chat request
func (c *Client) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	if req.Model == "" {
		req.Model = DefaultModel
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = DefaultMaxTokens
	}
	req.Stream = false

	respBody, err := c.doRequest(ctx, "/messages", req)
	if err != nil {
		return nil, err
	}

	var response ChatResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	c.logger.Debug("Claude chat completed",
		zap.String("model", response.Model),
		zap.Int("input_tokens", response.Usage.InputTokens),
		zap.Int("output_tokens", response.Usage.OutputTokens),
	)

	return &response, nil
}

// ChatStream sends a streaming chat request and returns a channel of events
func (c *Client) ChatStream(ctx context.Context, req *ChatRequest) (<-chan StreamEvent, error) {
	if req.Model == "" {
		req.Model = DefaultModel
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = DefaultMaxTokens
	}
	req.Stream = true

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", AnthropicAPIBaseURL+"/messages", bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", APIVersion)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("Claude API error (status %d): %s", resp.StatusCode, string(body))
	}

	events := make(chan StreamEvent, 100)

	go func() {
		defer close(events)
		defer resp.Body.Close()

		reader := bufio.NewReader(resp.Body)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				if err != io.EOF {
					c.logger.Error("Error reading stream", zap.Error(err))
				}
				return
			}

			line = strings.TrimSpace(line)
			if line == "" || !strings.HasPrefix(line, "data: ") {
				continue
			}

			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				return
			}

			var event StreamEvent
			if err := json.Unmarshal([]byte(data), &event); err != nil {
				c.logger.Error("Failed to parse stream event", zap.Error(err), zap.String("data", data))
				continue
			}

			select {
			case events <- event:
			case <-ctx.Done():
				return
			}
		}
	}()

	return events, nil
}

// doRequest performs a non-streaming HTTP request
func (c *Client) doRequest(ctx context.Context, path string, body interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", AnthropicAPIBaseURL+path, bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", APIVersion)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Claude API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}
