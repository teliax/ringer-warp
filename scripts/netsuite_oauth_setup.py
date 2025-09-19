#!/usr/bin/env python3
"""
NetSuite OAuth 2.0 Setup Script
This script helps with the initial OAuth setup for NetSuite integration.
Run this once to obtain initial access and refresh tokens.
"""

import os
import sys
import json
import time
import secrets
import webbrowser
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional, Dict, Any
import requests
from datetime import datetime, timedelta

# NetSuite Configuration
NETSUITE_CONFIG = {
    'account_id': '4708559',
    'base_url': 'https://4708559.suitetalk.api.netsuite.com/services/rest',
    'auth_url': 'https://4708559.app.netsuite.com/app/login/oauth2/authorize.nl',
    'token_url': 'https://4708559.restlets.api.netsuite.com/rest/platform/v1/oauth/token',
    'redirect_uri': 'http://localhost:8080/callback',
    'scope': 'rest_webservices',
    'response_type': 'code',
    'grant_type': 'authorization_code'
}

# Global variables to store OAuth data
auth_code: Optional[str] = None
auth_state: Optional[str] = None
server_shutdown = False


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler for OAuth callback"""
    
    def log_message(self, format, *args):
        """Suppress default HTTP server logging"""
        pass
    
    def do_GET(self):
        """Handle GET request from NetSuite OAuth callback"""
        global auth_code, auth_state
        
        if self.path.startswith('/callback'):
            # Parse query parameters
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            
            if 'code' in params:
                auth_code = params['code'][0]
                received_state = params.get('state', [None])[0]
                
                # Verify state parameter for CSRF protection
                if received_state != auth_state:
                    self.send_error_response("State parameter mismatch - possible CSRF attack")
                    return
                
                print(f"\n✅ Authorization code received!")
                print(f"   Code: {auth_code[:20]}...")
                
                # Send success response
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                
                success_html = """
                <!DOCTYPE html>
                <html>
                <head>
                    <title>NetSuite OAuth Success</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            margin: 0;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                            text-align: center;
                        }
                        h1 { color: #28a745; }
                        p { color: #666; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>✅ Authorization Successful!</h1>
                        <p>You can close this window and return to the terminal.</p>
                    </div>
                </body>
                </html>
                """
                self.wfile.write(success_html.encode())
            
            elif 'error' in params:
                error = params['error'][0]
                error_description = params.get('error_description', ['Unknown error'])[0]
                print(f"\n❌ Authorization failed: {error} - {error_description}")
                self.send_error_response(f"Authorization failed: {error_description}")
            
            else:
                self.send_error_response("No authorization code or error received")
        else:
            self.send_response(404)
            self.end_headers()
    
    def send_error_response(self, message: str):
        """Send error response to browser"""
        self.send_response(400)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        
        error_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>NetSuite OAuth Error</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background: #f8f9fa;
                    margin: 0;
                }}
                .container {{
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 500px;
                }}
                h1 {{ color: #dc3545; }}
                p {{ color: #666; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>❌ Authorization Failed</h1>
                <p>{message}</p>
            </div>
        </body>
        </html>
        """
        self.wfile.write(error_html.encode())


def generate_state() -> str:
    """Generate random state parameter for CSRF protection"""
    return secrets.token_urlsafe(32)


def generate_auth_url(client_id: str) -> str:
    """Generate NetSuite authorization URL"""
    global auth_state
    auth_state = generate_state()
    
    params = {
        'response_type': NETSUITE_CONFIG['response_type'],
        'client_id': client_id,
        'scope': NETSUITE_CONFIG['scope'],
        'redirect_uri': NETSUITE_CONFIG['redirect_uri'],
        'state': auth_state
    }
    
    return f"{NETSUITE_CONFIG['auth_url']}?{urllib.parse.urlencode(params)}"


def exchange_code_for_tokens(code: str, client_id: str, client_secret: str) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens"""
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    data = {
        'grant_type': NETSUITE_CONFIG['grant_type'],
        'code': code,
        'redirect_uri': NETSUITE_CONFIG['redirect_uri'],
        'client_id': client_id,
        'client_secret': client_secret
    }
    
    print("\n🔄 Exchanging authorization code for tokens...")
    
    try:
        response = requests.post(
            NETSUITE_CONFIG['token_url'],
            headers=headers,
            data=data,
            timeout=30
        )
        
        if response.status_code == 200:
            tokens = response.json()
            print("✅ Tokens received successfully!")
            return tokens
        else:
            print(f"❌ Token exchange failed: {response.status_code}")
            print(f"   Response: {response.text}")
            sys.exit(1)
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error during token exchange: {e}")
        sys.exit(1)


def refresh_access_token(refresh_token: str, client_id: str, client_secret: str) -> Dict[str, Any]:
    """Refresh an expired access token"""
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    data = {
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
        'client_id': client_id,
        'client_secret': client_secret
    }
    
    print("\n🔄 Refreshing access token...")
    
    try:
        response = requests.post(
            NETSUITE_CONFIG['token_url'],
            headers=headers,
            data=data,
            timeout=30
        )
        
        if response.status_code == 200:
            tokens = response.json()
            print("✅ Token refreshed successfully!")
            return tokens
        else:
            print(f"❌ Token refresh failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error during token refresh: {e}")
        return None


def save_tokens(tokens: Dict[str, Any], filename: str = 'netsuite_tokens.json'):
    """Save tokens to a JSON file"""
    
    # Add expiration timestamp
    if 'expires_in' in tokens:
        tokens['expires_at'] = (datetime.now() + timedelta(seconds=tokens['expires_in'])).isoformat()
    
    # Add timestamp
    tokens['obtained_at'] = datetime.now().isoformat()
    
    # Save to file
    filepath = os.path.join(os.path.dirname(__file__), filename)
    with open(filepath, 'w') as f:
        json.dump(tokens, f, indent=2)
    
    print(f"\n✅ Tokens saved to: {filepath}")
    
    # Set restrictive permissions (Unix-like systems only)
    try:
        os.chmod(filepath, 0o600)
        print("   File permissions set to 600 (read/write for owner only)")
    except:
        pass


def load_tokens(filename: str = 'netsuite_tokens.json') -> Optional[Dict[str, Any]]:
    """Load tokens from a JSON file"""
    filepath = os.path.join(os.path.dirname(__file__), filename)
    
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    return None


def test_api_connection(access_token: str) -> bool:
    """Test the API connection using the access token"""
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
    print("\n🔍 Testing API connection...")
    
    try:
        # Test with company information endpoint
        response = requests.get(
            f"{NETSUITE_CONFIG['base_url']}/config/v1/companyinformation",
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API connection successful!")
            print(f"   Company Name: {data.get('companyName', 'N/A')}")
            return True
        else:
            print(f"❌ API test failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error during API test: {e}")
        return False


def main():
    """Main function to run the OAuth setup"""
    
    print("=" * 60)
    print("NetSuite OAuth 2.0 Setup Script")
    print("=" * 60)
    print(f"\nAccount ID: {NETSUITE_CONFIG['account_id']}")
    print(f"Redirect URI: {NETSUITE_CONFIG['redirect_uri']}")
    
    # Check for existing tokens
    existing_tokens = load_tokens()
    if existing_tokens and 'refresh_token' in existing_tokens:
        print("\n📝 Existing tokens found!")
        
        choice = input("\nDo you want to:\n1. Refresh existing tokens\n2. Start new authorization\nChoice (1 or 2): ")
        
        if choice == '1':
            # Get credentials from environment or input
            client_id = os.environ.get('NETSUITE_CLIENT_ID')
            client_secret = os.environ.get('NETSUITE_CLIENT_SECRET')
            
            if not client_id or not client_secret:
                print("\n⚠️  Client credentials not found in environment variables.")
                client_id = input("Enter Client ID: ")
                client_secret = input("Enter Client Secret: ")
            
            # Refresh token
            new_tokens = refresh_access_token(
                existing_tokens['refresh_token'],
                client_id,
                client_secret
            )
            
            if new_tokens:
                # Preserve refresh token if not returned
                if 'refresh_token' not in new_tokens:
                    new_tokens['refresh_token'] = existing_tokens['refresh_token']
                
                save_tokens(new_tokens)
                
                # Test connection
                if test_api_connection(new_tokens['access_token']):
                    print("\n✅ Setup complete! Your NetSuite integration is ready.")
                return
    
    # Get OAuth credentials
    client_id = os.environ.get('NETSUITE_CLIENT_ID')
    client_secret = os.environ.get('NETSUITE_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        print("\n⚠️  Client credentials not found in environment variables.")
        print("Please enter your NetSuite OAuth client credentials:")
        client_id = input("Client ID: ")
        client_secret = input("Client Secret: ")
    
    # Generate authorization URL
    auth_url = generate_auth_url(client_id)
    
    # Start local server
    print(f"\n🚀 Starting local server on port 8080...")
    server = HTTPServer(('localhost', 8080), OAuthCallbackHandler)
    
    # Open browser
    print(f"\n🌐 Opening browser for authorization...")
    print(f"   If the browser doesn't open, navigate to:\n   {auth_url}")
    webbrowser.open(auth_url)
    
    # Wait for callback
    print("\n⏳ Waiting for authorization callback...")
    print("   Please log in to NetSuite and authorize the application.")
    
    # Handle one request (the callback)
    server.handle_request()
    
    # Check if we got the code
    if auth_code:
        # Exchange code for tokens
        tokens = exchange_code_for_tokens(auth_code, client_id, client_secret)
        
        # Save tokens
        save_tokens(tokens)
        
        # Test API connection
        if test_api_connection(tokens['access_token']):
            print("\n" + "=" * 60)
            print("✅ Setup complete! Your NetSuite integration is ready.")
            print("=" * 60)
            
            print("\n📋 Next steps:")
            print("1. Move the tokens file to a secure location")
            print("2. Configure your application to use these tokens")
            print("3. Implement token refresh logic in your backend")
            
            print("\n🔑 Token Information:")
            print(f"   Access Token: {tokens['access_token'][:20]}...")
            print(f"   Refresh Token: {tokens['refresh_token'][:20]}...")
            print(f"   Expires In: {tokens.get('expires_in', 'N/A')} seconds")
            
    else:
        print("\n❌ Authorization failed - no code received")
        sys.exit(1)
    
    # Shutdown server
    server.server_close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
