"""
LSMS API Client for LRN and Phone Number Management

This module provides access to the Telique LSMS (Local Service Management System) API endpoints
for LRN (Local Routing Number) and phone number lookups.

API Endpoints:
- /v1/telique/lsms/list/lrn?spid={SPID} - Get all LRNs for a specific SPID/OCN
- /v1/telique/lsms/list/phone_number?lrn={LRN} - Get all phone numbers for a specific LRN

Authentication:
- API Token required via x-api-token header

Response Formats:
- JSON with lrns/phone_numbers arrays and count
"""

import logging
import os
import time
import requests
from typing import List, Optional, Dict, Any
from urllib.parse import urljoin


class LSMSAPIClient:
    """Client for Telique LSMS API"""
    
    def __init__(self, api_url: str = None, api_token: str = None):
        """
        Initialize LSMS API client
        
        Args:
            api_url: Base URL for the API (default from environment or https://api-dev.ringer.tel)
            api_token: API token for authentication (default from TELIQUE_API_TOKEN env var)
        """
        self.api_url = api_url or os.environ.get('LSMS_API_URL', 'https://api-dev.ringer.tel')
        self.api_token = api_token or os.environ.get('TELIQUE_API_TOKEN')
        
        if not self.api_token:
            raise ValueError("LSMS API token required. Set TELIQUE_API_TOKEN environment variable.")
        
        # Common headers for all requests
        self.headers = {
            'x-api-token': self.api_token,
            'Accept': 'application/json',
            'User-Agent': 'NumberAudit/1.0'
        }
        
        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
        logging.info(f"Initialized LSMS API client with URL: {self.api_url}")
    
    def get_lrns_by_spid(self, spid: str) -> List[str]:
        """
        Get all LRNs associated with a specific SPID/OCN
        
        Args:
            spid: The SPID/OCN to lookup (e.g., '781K')
            
        Returns:
            List of LRNs for the given SPID
            
        Example response:
            {
                "lrns": ["3146360999", "4344380999", "4708470199"],
                "count": 3,
                "query": {"spid": "781K"}
            }
        """
        endpoint = f"/v1/telique/lsms/list/lrn"
        url = urljoin(self.api_url, endpoint)
        params = {'spid': spid}
        
        try:
            print(f"  → Fetching LRNs for SPID {spid}...")
            logging.debug(f"Fetching LRNs for SPID {spid}")
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            lrns = data.get('lrns', [])
            count = data.get('count', 0)
            
            print(f"    ✓ Found {count} LRNs for SPID {spid}")
            logging.info(f"Found {count} LRNs for SPID {spid}")
            return lrns
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching LRNs for SPID {spid}: {e}")
            raise
    
    def get_phone_numbers_by_lrn(self, lrn: str) -> List[str]:
        """
        Get all phone numbers associated with a specific LRN
        
        Args:
            lrn: The LRN to lookup (e.g., '4708470199')
            
        Returns:
            List of phone numbers for the given LRN
            
        Example response:
            {
                "phone_numbers": ["4042825582", "4708470199"],
                "count": 2,
                "query": {"lrn": "4708470199"}
            }
        """
        endpoint = f"/v1/telique/lsms/list/phone_number"
        url = urljoin(self.api_url, endpoint)
        params = {'lrn': lrn}
        
        try:
            logging.debug(f"Fetching phone numbers for LRN {lrn}")
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            phone_numbers = data.get('phone_numbers', [])
            count = data.get('count', 0)
            
            print(f"    → LRN {lrn}: {count} phone numbers")
            logging.debug(f"Found {count} phone numbers for LRN {lrn}")
            return phone_numbers
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching phone numbers for LRN {lrn}: {e}")
            raise
    
    def discover_lrns_by_ocns(self, ocns: List[str]) -> List[str]:
        """
        Discover all LRNs for a list of OCNs/SPIDs
        
        Args:
            ocns: List of OCNs/SPIDs to search for
            
        Returns:
            Combined list of all discovered LRNs
        """
        all_lrns = []
        total_start = time.time()
        
        for ocn in ocns:
            try:
                logging.info(f"Discovering LRNs for OCN {ocn}")
                lrns = self.get_lrns_by_spid(ocn)
                all_lrns.extend(lrns)
                logging.info(f"Found {len(lrns)} LRNs for OCN {ocn}")
            except Exception as e:
                logging.error(f"Failed to get LRNs for OCN {ocn}: {e}")
                # Continue with other OCNs even if one fails
                continue
        
        total_time = time.time() - total_start
        logging.info(f"Discovered {len(all_lrns)} total LRNs across {len(ocns)} OCNs in {total_time:.2f}s")
        
        # Remove duplicates while preserving order
        unique_lrns = list(dict.fromkeys(all_lrns))
        if len(unique_lrns) < len(all_lrns):
            logging.info(f"Removed {len(all_lrns) - len(unique_lrns)} duplicate LRNs")
        
        return unique_lrns
    
    def batch_get_phone_numbers(self, lrns: List[str], batch_size: int = 10) -> Dict[str, List[str]]:
        """
        Get phone numbers for multiple LRNs in batches
        
        Args:
            lrns: List of LRNs to lookup
            batch_size: Number of concurrent requests (not used currently, sequential processing)
            
        Returns:
            Dictionary mapping LRN to list of phone numbers
        """
        results = {}
        total_numbers = 0
        start_time = time.time()
        
        print(f"Fetching phone numbers for {len(lrns)} LRNs...")
        logging.info(f"Fetching phone numbers for {len(lrns)} LRNs")
        
        for i, lrn in enumerate(lrns, 1):
            try:
                phone_numbers = self.get_phone_numbers_by_lrn(lrn)
                results[lrn] = phone_numbers
                total_numbers += len(phone_numbers)
                
                # Progress logging for large batches
                if i % 10 == 0 or i == len(lrns):
                    elapsed = time.time() - start_time
                    rate = i / elapsed if elapsed > 0 else 0
                    logging.info(f"Progress: {i}/{len(lrns)} LRNs processed ({rate:.1f} LRNs/sec)")
                    
            except Exception as e:
                logging.error(f"Failed to get phone numbers for LRN {lrn}: {e}")
                results[lrn] = []  # Empty list for failed lookups
        
        total_time = time.time() - start_time
        logging.info(f"Retrieved {total_numbers} phone numbers for {len(lrns)} LRNs in {total_time:.2f}s")
        
        return results
    
    def health_check(self) -> bool:
        """
        Check if the LSMS API is accessible
        
        Returns:
            True if API is healthy, False otherwise
        """
        try:
            # Try to get LRNs for a known test SPID
            # This should return empty or minimal results but verify connectivity
            endpoint = "/v1/telique/lsms/list/lrn"
            url = urljoin(self.api_url, endpoint)
            params = {'spid': 'TEST'}
            
            response = self.session.get(url, params=params, timeout=5)
            return response.status_code == 200
            
        except Exception as e:
            logging.error(f"LSMS API health check failed: {e}")
            return False
    
    def close(self):
        """Close the HTTP session"""
        self.session.close()

