package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GoogleTokenInfo represents validated Google OAuth token information
type GoogleTokenInfo struct {
	Sub           string `json:"sub"`            // Google user ID (unique identifier)
	Email         string `json:"email"`          // User email
	EmailVerified bool   `json:"email_verified"` // Email verification status
	Name          string `json:"name"`           // Display name
	Picture       string `json:"picture"`        // Profile photo URL
	Aud           string `json:"aud"`            // Audience (your client ID)
	Iss           string `json:"iss"`            // Issuer (accounts.google.com)
	Exp           int64  `json:"exp"`            // Expiration time
}

// GoogleOAuthVerifier handles Google OAuth token verification
type GoogleOAuthVerifier struct {
	clientID string
}

// NewGoogleOAuthVerifier creates a new Google OAuth verifier
func NewGoogleOAuthVerifier(clientID string) *GoogleOAuthVerifier {
	return &GoogleOAuthVerifier{
		clientID: clientID,
	}
}

// VerifyIDToken verifies a Google ID token
func (v *GoogleOAuthVerifier) VerifyIDToken(ctx context.Context, idToken string) (*GoogleTokenInfo, error) {
	// Use Google's tokeninfo endpoint to verify the token
	url := "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to verify token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token verification failed: %s", string(body))
	}

	var tokenInfo GoogleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, fmt.Errorf("failed to decode token info: %w", err)
	}

	// Verify the token is for our application
	if tokenInfo.Aud != v.clientID {
		return nil, fmt.Errorf("token audience mismatch: expected %s, got %s", v.clientID, tokenInfo.Aud)
	}

	// Verify the token hasn't expired
	if time.Now().Unix() > tokenInfo.Exp {
		return nil, fmt.Errorf("token has expired")
	}

	// Verify issuer
	if tokenInfo.Iss != "accounts.google.com" && tokenInfo.Iss != "https://accounts.google.com" {
		return nil, fmt.Errorf("invalid token issuer: %s", tokenInfo.Iss)
	}

	return &tokenInfo, nil
}

// VerifyAccessToken verifies a Google access token (alternative method)
func (v *GoogleOAuthVerifier) VerifyAccessToken(ctx context.Context, accessToken string) (*GoogleTokenInfo, error) {
	// Use Google's tokeninfo endpoint for access tokens
	url := "https://oauth2.googleapis.com/tokeninfo?access_token=" + accessToken

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to verify token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token verification failed: %s", string(body))
	}

	var tokenInfo GoogleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, fmt.Errorf("failed to decode token info: %w", err)
	}

	return &tokenInfo, nil
}
