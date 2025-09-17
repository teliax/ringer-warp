import os
import time
import logging
import requests
import base64
import json
from typing import Dict, List, Optional, Tuple


class SomosAPIClient:
    """Client for authenticating and interacting with the Somos TFN Registry API"""
    
    def __init__(self, 
                 username: str, 
                 password: str, 
                 production: bool = True,
                 client_key: str = None, 
                 client_secret: str = None, 
                 refresh_token: str = None):
        """
        Initialize the Somos API client
        
        Args:
            username: Somos API username
            password: Somos API password
            production: Whether to use production or sandbox API
            client_key: Optional existing client key
            client_secret: Optional existing client secret
            refresh_token: Optional existing refresh token
        """
        self.username = username
        self.password = password
        self.production = production
        
        # Store which environment we're using for logging
        env_type = "production" if production else "sandbox"
        logging.info(f"Initializing Somos API client for {env_type} environment")
        
        # OAuth credentials
        self.client_key = client_key
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.access_token = None
        self.oauth_token = None  # Added to store oauth token from session/open
        self.token_expiry = 0
        
        # If we have partial credentials, make sure we have all required ones
        if any([client_key, client_secret, refresh_token]) and not all([client_key, client_secret, refresh_token]):
            logging.warning("Partial credentials provided. Need all three: client_key, client_secret, and refresh_token")
            # Reset to ensure we do a fresh authentication
            self.client_key = None
            self.client_secret = None 
            self.refresh_token = None
    
    def authenticate(self) -> bool:
        """
        Authenticate with the Somos API
        
        This will:
        1. Open a session to get client credentials and a refresh token if needed
        2. Get an access token using refresh token
        
        Returns:
            bool: True if authentication was successful
        """
        try:
            # Step 1: Get client credentials if we don't have them
            if not all([self.client_key, self.client_secret, self.refresh_token]):
                # First attempt - try to open a new session
                session_result = self._open_session()
                
                # If that failed, try with force flag
                if not session_result:
                    logging.info("Authentication failed, attempting with force flag...")
                    session_result = self._open_session_with_force()
                    
                    # If that still failed, we're out of options
                    if not session_result:
                        logging.error("Failed to open Somos API session after retry with force flag")
                        return False
            
            # Step 2: Get access token 
            token_result = self._get_access_token()
            if not token_result:
                logging.error("Failed to get Somos API access token")
                return False
                
            return True
            
        except Exception as e:
            logging.error(f"Authentication error: {e}")
            return False
    
    def _open_session(self) -> bool:
        """
        Open a Somos API session to get client credentials
        
        Returns:
            bool: True if session was opened successfully
        """
        # Use exact same URL as the curl command
        url = "https://api-tfnregistry.somos.com/v3/ip/sec/session/open"
        if not self.production:
            url = "https://sandbox-api-tfnregistry.somos.com/v3/ip/sec/session/open"
            
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Format data exactly as in curl command
        data = {
            "usrName": self.username,
            "password": self.password,
            "withPerm": False
        }
        
        try:
            logging.info(f"Opening Somos API session at {url}...")
            logging.debug(f"Request data: {json.dumps(data)}")
            
            # Use json parameter to ensure proper JSON formatting
            response = requests.post(url, headers=headers, json=data)
            
            # Log the full response for debugging
            logging.info(f"Somos API response status code: {response.status_code}")
            logging.info(f"Somos API response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                
                # Check if there's an error indicating user is already logged in
                if "errList" in result and len(result.get("errList", [])) > 0:
                    error = result["errList"][0]
                    if error.get("errCode") == "701003" and "sessOverrideKey" in result:
                        # User is already logged on, need to reconnect
                        logging.info("User is already logged on. Attempting to reconnect...")
                        return self._reconnect_session(result["sessOverrideKey"])
                    else:
                        # Some other error
                        logging.error(f"Session open error: {error.get('errMsg')}")
                        return False
                
                # Extract credentials exactly as they appear in your response
                self.client_key = result.get("clientKey")
                self.client_secret = result.get("clientSecret")
                self.refresh_token = result.get("refreshToken")
                # Your response also has oauthToken which we should capture
                self.oauth_token = result.get("oauthToken")
                
                if all([self.client_key, self.client_secret, self.refresh_token]):
                    logging.info("Successfully obtained Somos API credentials")
                    return True
                else:
                    logging.error(f"Missing credentials in response. Response content: {response.text}")
                    return False
            else:
                logging.error(f"Session open failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"Error opening session: {e}")
            return False
    
    def _reconnect_session(self, sess_override_key: str) -> bool:
        """
        Reconnect to an existing session using the session override key
        
        Args:
            sess_override_key: Session override key from the error response
            
        Returns:
            bool: True if reconnection was successful
        """
        # Use exact URL from pattern
        url = "https://api-tfnregistry.somos.com/v3/ip/sec/session/open"
        if not self.production:
            url = "https://sandbox-api-tfnregistry.somos.com/v3/ip/sec/session/open"
            
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        data = {
            "usrName": self.username,
            "password": self.password,
            "sessOverrideKey": sess_override_key,
            "withPerm": False
        }
        
        try:
            logging.info(f"Reconnecting to Somos API session at {url}...")
            logging.debug(f"Request data: {json.dumps(data)}")
            response = requests.post(url, headers=headers, json=data)
            
            # Log the full response for debugging
            logging.info(f"Somos API reconnect response status code: {response.status_code}")
            logging.info(f"Somos API reconnect response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                
                # Check for errors first
                if "errList" in result and len(result.get("errList", [])) > 0:
                    error = result["errList"][0]
                    logging.error(f"Session reconnect error: {error.get('errMsg')}")
                    return False
                
                # Extract credentials
                self.client_key = result.get("clientKey")
                self.client_secret = result.get("clientSecret")
                self.refresh_token = result.get("refreshToken")
                # Your response also has oauthToken which we should capture
                self.oauth_token = result.get("oauthToken")
                
                if all([self.client_key, self.client_secret, self.refresh_token]):
                    logging.info("Successfully reconnected and obtained Somos API credentials")
                    return True
                else:
                    logging.error(f"Missing credentials in reconnect response. Response content: {response.text}")
                    return False
            else:
                logging.error(f"Session reconnect failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"Error reconnecting to session: {e}")
            return False
    
    def _get_access_token(self) -> bool:
        """
        Get an access token using refresh token
        
        Returns:
            bool: True if token was obtained successfully
        """
        if not all([self.client_key, self.client_secret, self.refresh_token]):
            logging.error("Missing client credentials. Call authenticate() first.")
            return False
        
        # Use exact URL from curl command
        url = "https://api-tfnregistry.somos.com/token"
        if not self.production:
            url = "https://sandbox-api-tfnregistry.somos.com/token"
        
        # Create the basic auth header exactly as in curl
        auth_string = f"{self.client_key}:{self.client_secret}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {encoded_auth}"
        }
        
        # Format data exactly as in the curl command - as form data, not JSON
        # For requests library with form-urlencoded, we need to use data parameter
        data = f"grant_type=refresh_token&refresh_token={self.refresh_token}"
        
        try:
            logging.info(f"Getting Somos API access token from {url}...")
            logging.debug(f"Request data: {data}")
            logging.debug(f"Authorization header: Basic {encoded_auth}")
            
            # Send the request with data as a string (not a dict)
            response = requests.post(url, headers=headers, data=data)
            
            # Log the full response for debugging
            logging.info(f"Somos token API response status code: {response.status_code}")
            logging.info(f"Somos token API response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                self.access_token = result.get("access_token")
                
                # Update the refresh token for next time
                new_refresh_token = result.get("refresh_token")
                if new_refresh_token:
                    self.refresh_token = new_refresh_token
                
                # Calculate expiry time (current time + expires_in - 5 min buffer)
                expires_in = result.get("expires_in", 3600)
                self.token_expiry = int(time.time()) + expires_in - 300
                
                logging.info(f"Successfully obtained access token, expires in {expires_in} seconds")
                return True
            else:
                logging.error(f"Token request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"Error getting access token: {e}")
            return False
    
    def ensure_valid_token(self) -> bool:
        """
        Ensure we have a valid access token, refreshing if needed
        
        Returns:
            bool: True if we have a valid token
        """
        current_time = int(time.time())
        
        # If token is expired or about to expire, refresh it
        if not self.access_token or current_time > self.token_expiry:
            return self._get_access_token()
            
        return True
    
    def get_entity_roids(self, entity_id: str) -> List[str]:
        """
        Get all Responsible Organization IDs (ROIDs) for an entity
        
        Args:
            entity_id: Two-character entity ID (e.g., "NE")
            
        Returns:
            List of Responsible Organization IDs
        """
        if not self.ensure_valid_token():
            logging.error("Failed to ensure valid token for API request")
            return []
        
        # Use exact URL from curl command
        url = f"https://api-tfnregistry.somos.com/v3/ip/org/resporg/ent/{entity_id}"
        if not self.production:
            url = f"https://sandbox-api-tfnregistry.somos.com/v3/ip/org/resporg/ent/{entity_id}"
        
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.access_token}"
        }
        
        try:
            logging.info(f"Getting ROIDs for entity {entity_id}...")
            response = requests.get(url, headers=headers)
            
            # Log the response for debugging
            logging.info(f"Entity API response status code: {response.status_code}")
            logging.debug(f"Entity API response content: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                roids = []
                
                # Extract ROIDs from the response - using associatedRespOrgs based on the actual response format
                associated_resp_orgs = result.get("associatedRespOrgs", [])
                for resp_org in associated_resp_orgs:
                    roid = resp_org.get("respOrgId")
                    if roid:
                        # Only include active ROIDs
                        if resp_org.get("status") == "ACTIVE":
                            roids.append(roid)
                            logging.debug(f"Found active ROID: {roid}")
                        else:
                            logging.debug(f"Skipping non-active ROID: {roid} with status {resp_org.get('status')}")
                
                logging.info(f"Found {len(roids)} active ROIDs for entity {entity_id}")
                return roids
            else:
                logging.error(f"Failed to get ROIDs: {response.status_code} - {response.text}")
                return []
                
        except Exception as e:
            logging.error(f"Error getting ROIDs: {e}")
            return []
    
    def close_session(self) -> bool:
        """
        Close the Somos API session
        
        Returns:
            bool: True if session was closed successfully or if no active session
        """
        # If we have an access token, use it to close the session
        if self.access_token:
            # Use exact URL from pattern
            url = "https://api-tfnregistry.somos.com/v3/ip/sec/session/close"
            if not self.production:
                url = "https://sandbox-api-tfnregistry.somos.com/v3/ip/sec/session/close"
                
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Bearer {self.access_token}"
            }
            
            # API spec says this is a PUT request with a body
            data = {}  # Empty body as per sessionCloseRequest schema
            
            try:
                logging.info(f"Closing Somos API session at {url} with token...")
                # Use PUT method as specified in the API documentation
                response = requests.put(url, headers=headers, json=data)
                
                # Log the full response for debugging
                logging.info(f"Somos API close session response status code: {response.status_code}")
                logging.info(f"Somos API close session response: {response.text}")
                
                # Reset credentials regardless of the response
                self.client_key = None
                self.client_secret = None
                self.refresh_token = None
                self.access_token = None
                self.token_expiry = 0
                
                return True
                    
            except Exception as e:
                logging.error(f"Error closing session with token: {e}")
                
                # Reset credentials anyway
                self.client_key = None
                self.client_secret = None
                self.refresh_token = None
                self.access_token = None
                self.token_expiry = 0
                
                return False
        else:
            # No access token, try to force disconnect using username/password
            try:
                # We don't have a token, so we'll try to force disconnect by login request with forceFlag
                url = "https://api-tfnregistry.somos.com/v3/ip/sec/session/open"
                if not self.production:
                    url = "https://sandbox-api-tfnregistry.somos.com/v3/ip/sec/session/open"
                    
                headers = {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
                data = {
                    "usrName": self.username,
                    "password": self.password,
                    "forceFlag": "Y",
                    "withPerm": False
                }
                
                logging.info(f"Attempting to force close existing session at {url}...")
                logging.debug(f"Request data: {json.dumps(data)}")
                response = requests.post(url, headers=headers, json=data)
                
                # Log the full response for debugging
                logging.info(f"Somos API force close response status code: {response.status_code}")
                logging.info(f"Somos API force close response: {response.text}")
                
                # We don't care about the result here, we're just trying to force close
                # Reset credentials
                self.client_key = None
                self.client_secret = None
                self.refresh_token = None
                self.access_token = None
                self.token_expiry = 0
                
                return True
                
            except Exception as e:
                logging.error(f"Error force closing session: {e}")
                return False
    
    def _open_session_with_force(self) -> bool:
        """
        Open a Somos API session with force flag to disconnect existing sessions
        
        Returns:
            bool: True if session was opened successfully
        """
        # Use exact URL from pattern
        url = "https://api-tfnregistry.somos.com/v3/ip/sec/session/open"
        if not self.production:
            url = "https://sandbox-api-tfnregistry.somos.com/v3/ip/sec/session/open"
            
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        data = {
            "usrName": self.username,
            "password": self.password,
            "withPerm": False,
            "forceFlag": "Y"
        }
        
        try:
            logging.info(f"Opening Somos API session with force flag at {url}...")
            logging.debug(f"Request data: {json.dumps(data)}")
            response = requests.post(url, headers=headers, json=data)
            
            # Log the full response for debugging
            logging.info(f"Somos API force flag response status code: {response.status_code}")
            logging.info(f"Somos API force flag response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                
                # Check if there's an error
                if "errList" in result and len(result.get("errList", [])) > 0:
                    error = result["errList"][0]
                    logging.error(f"Session open with force flag error: {error.get('errMsg')}")
                    return False
                
                # Extract credentials
                self.client_key = result.get("clientKey")
                self.client_secret = result.get("clientSecret")
                self.refresh_token = result.get("refreshToken")
                # Your response also has oauthToken which we should capture
                self.oauth_token = result.get("oauthToken")
                
                if all([self.client_key, self.client_secret, self.refresh_token]):
                    logging.info("Successfully obtained Somos API credentials with force flag")
                    return True
                else:
                    logging.error(f"Missing credentials in force flag response. Response content: {response.text}")
                    return False
            else:
                logging.error(f"Session open with force flag failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"Error opening session with force flag: {e}")
            return False 