"""
Telique LERG API Client
Provides access to LERG data through Telique's API instead of direct database access
"""

import requests
import logging
from typing import Dict, List, Any, Optional
from urllib.parse import urljoin
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class TeliqueLERGAPIClient:
    """
    Client for interacting with the Telique LERG API.
    Replaces direct MySQL LERG database access.
    """
    
    def __init__(self, api_base_url: str, api_token: str, timeout: int = 30):
        """
        Initialize the Telique LERG API client.
        
        Args:
            api_base_url: Base URL for the API (e.g., https://api-dev.ringer.tel/v1/telique/lerg)
            api_token: API authentication token
            timeout: Request timeout in seconds
        """
        self.api_base_url = api_base_url.rstrip('/')
        self.api_token = api_token
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'x-api-token': api_token,
            'Content-Type': 'application/json'
        })
        
        # Initialize caches
        self._lerg6_cache = {}  # Cache for LERG_6 data keyed by (npa, nxx, block_id)
        self._switch_cache = {}  # Cache for switch/tandem lookups
        self._ocn_name_cache = {}  # Cache for OCN names
        
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        Make an HTTP request to the API.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            **kwargs: Additional request parameters
            
        Returns:
            Response JSON data
            
        Raises:
            requests.exceptions.RequestException: On API errors
        """
        # Ensure endpoint doesn't start with / for proper URL joining
        endpoint = endpoint.lstrip('/')
        url = urljoin(self.api_base_url + '/', endpoint)
        kwargs['timeout'] = kwargs.get('timeout', self.timeout)
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
            
    def health_check(self) -> Dict[str, Any]:
        """Check API health status."""
        return self._make_request('GET', '/health')
        
    def get_table_info(self, table_name: str) -> Dict[str, Any]:
        """Get metadata for a specific LERG table."""
        return self._make_request('GET', f'/tables/{table_name}')
        
    def simple_query(self, table: str, fields: List[str], filters: Dict[str, Any], 
                    limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """
        Perform a simple query using the GET endpoint.
        
        Args:
            table: LERG table name (e.g., 'lerg_6')
            fields: List of fields to return
            filters: Dictionary of field:value filters
            limit: Maximum records to return
            offset: Number of records to skip
            
        Returns:
            Query response with data
        """
        fields_str = ','.join(fields)
        filter_parts = [f"{k}={v}" for k, v in filters.items()]
        query_str = '&'.join(filter_parts) if filter_parts else ''
        
        # Construct endpoint without /lerg prefix (already in base URL)
        endpoint = f'/{table}/{fields_str}/{query_str}'
        params = {'limit': limit, 'offset': offset}
        
        return self._make_request('GET', endpoint, params=params)
        
    def complex_query(self, table: str, fields: Optional[List[str]] = None,
                     filters: Optional[List[Dict[str, Any]]] = None,
                     limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """
        Perform a complex query using the POST endpoint.
        
        Args:
            table: LERG table name
            fields: List of fields to return (None for all)
            filters: List of filter conditions
            limit: Maximum records to return
            offset: Number of records to skip
            
        Returns:
            Query response with data
        """
        payload = {
            'table': table,
            'limit': limit,
            'offset': offset
        }
        
        if fields:
            payload['fields'] = fields
            
        if filters:
            payload['filters'] = filters
            
        return self._make_request('POST', '/query', json=payload)
        
    def get_ocn_info_by_npanxx(self, ocns: List[str], batch_size: int = 1000) -> List[Dict[str, Any]]:
        """
        Get OCN information for NPANXX blocks, similar to OCNinfo.sql query.
        
        This replaces the complex SQL join query with multiple API calls.
        """
        all_results = []
        
        print(f"Fetching LERG data for {len(ocns)} OCNs...")
        
        # Process each OCN separately using simple GET queries
        for ocn_idx, ocn in enumerate(ocns, 1):
            offset = 0
            
            print(f"  → Processing OCN {ocn} ({ocn_idx}/{len(ocns)})...")
            
            while True:
                try:
                    # Use simple_query for each OCN with correct endpoint
                    lerg6_response = self.simple_query(
                        'lerg_6',
                        fields=['npa', 'nxx', 'block_id', 'switch', 'ocn', 'lata', 'lata_name',
                               'creation_date', 'e_status_date', 'last_modified',
                               'aocn', 'loc_name', 'loc_state', 'coc_type', 'ssc'],
                        filters={'ocn': ocn},
                        limit=batch_size,
                        offset=offset
                    )
                    
                    lerg6_data = lerg6_response.get('data', [])
                    
                    # Filter out block_id='A' records in post-processing
                    filtered_data = [record for record in lerg6_data if record.get('block_id') != 'A']
                    
                    # Process each record
                    record_count = len(filtered_data)
                    if record_count > 0:
                        print(f"    ✓ Found {record_count} NPANXXX blocks, processing tandem lookups...")
                    
                    for record_idx, record in enumerate(filtered_data, 1):
                        poi = record.get('switch')  # POI is the switch field
                        result = {
                            'OCN': ocn,
                            'NPANXXX': f"{record.get('npa')}{record.get('nxx')}{record.get('block_id')}",
                            'POI': poi,
                            'POI_OCN': ocn,  # POI_OCN is the same as OCN from the query
                            'LATA': record.get('lata'),
                            'LATA_NAME': record.get('lata_name'),
                            'CREATION_DATE': record.get('creation_date'),
                            'E_STATUS_DATE': record.get('e_status_date'),
                            'LAST_MODIFIED': record.get('last_modified'),
                            'AOCN': record.get('aocn'),
                            'LOC_NAME': record.get('loc_name'),
                            'LOC_STATE': record.get('loc_state'),
                            'coc_type': record.get('coc_type'),
                            'ssc': record.get('ssc')
                        }
                        
                        # Skip OCN name lookup for now (as requested)
                        # result['OCN_NAME'] = self._get_ocn_name(ocn)
                        
                        # Get D tandem information using the legacy method for compatibility
                        if record_count > 10 and record_idx % 5 == 0:
                            print(f"      → Tandem lookup progress: {record_idx}/{record_count}")
                        switch_info = self._get_switch_tandem_info(poi)
                        result.update(switch_info)
                        
                        all_results.append(result)
                    
                    # Check if we've received all records
                    if len(lerg6_data) < batch_size:
                        break
                        
                    offset += batch_size
                    
                except Exception as e:
                    logger.warning(f"Failed to get LERG_6 data for OCN {ocn}: {e}")
                    break
            
            print(f"    ✓ Completed OCN {ocn}")
                
        print(f"LERG data fetch complete: {len(all_results)} total records")
        return all_results
        
    def _get_ocn_name(self, ocn: str) -> Optional[str]:
        """Get OCN name from LERG_1 table."""
        if not ocn:
            return None
            
        # Check cache first
        if ocn in self._ocn_name_cache:
            return self._ocn_name_cache[ocn]
            
        try:
            response = self.simple_query(
                'lerg_1',
                fields=['ocn_name'],
                filters={'ocn_num': ocn},
                limit=1
            )
            data = response.get('data', [])
            ocn_name = data[0].get('ocn_name') if data else None
            
            # Cache the result
            self._ocn_name_cache[ocn] = ocn_name
            return ocn_name
        except Exception as e:
            logger.warning(f"Failed to get OCN name for {ocn}: {e}")
            return None
            
    def _get_switch_tandem_info_v2(self, switch: str) -> Dict[str, Any]:
        """
        Get switch and tandem information using the new two-query pattern.
        1. Get D Tandem CLLI from LERG_7_SHA
        2. Get D Tandem OCN from LERG_7
        """
        result = {
            'TANDEM': None,
            'T_OCN': None,
            'TANDEM_NAME': None
        }
        
        if not switch:
            return result
            
        # Check cache first
        cache_key = f"tandem_{switch}"
        if cache_key in self._switch_cache:
            return self._switch_cache[cache_key]
            
        try:
            # Query 1: Get D Tandem CLLI code
            sha_response = self.simple_query(
                'lerg_7_sha',
                fields=['h_trm_d_tdm'],
                filters={'switch': switch, 'sha_indicator': '00'},
                limit=1
            )
            sha_data = sha_response.get('data', [])
            
            if sha_data:
                d_tandem_switch = sha_data[0].get('h_trm_d_tdm')
                result['TANDEM'] = d_tandem_switch
                
                # Query 2: Get D Tandem OCN
                if d_tandem_switch:
                    tandem_response = self.simple_query(
                        'lerg_7',
                        fields=['ocn'],
                        filters={'switch': d_tandem_switch},
                        limit=1
                    )
                    tandem_data = tandem_response.get('data', [])
                    
                    if tandem_data:
                        tandem_ocn = tandem_data[0].get('ocn')
                        result['T_OCN'] = tandem_ocn
                        
                        # Get tandem OCN name
                        result['TANDEM_NAME'] = self._get_ocn_name(tandem_ocn)
                        
        except Exception as e:
            logger.warning(f"Failed to get switch/tandem info for {switch}: {e}")
            
        # Cache the result
        self._switch_cache[cache_key] = result
        return result
            
    def _get_switch_tandem_info(self, switch: str) -> Dict[str, Any]:
        """Legacy method for backward compatibility."""
        # Use the new v2 method internally
        v2_result = self._get_switch_tandem_info_v2(switch)
        # Map v2 field names to legacy field names
        return {
            'ACTUAL': None,  # Not used in v2
            'TANDEM': v2_result['TANDEM'],
            'TANDEM_OCN': v2_result['T_OCN'],  # This is correct mapping
            'TANDEM_NAME': v2_result['TANDEM_NAME']
        }
        
    def get_lerg_data_for_lrns(self, lrns: List[str], batch_size: int = 50) -> List[Dict[str, Any]]:
        """
        Get LERG data for a batch of LRNs with caching.
        Replaces the remember_ocn_batch SQL query in audit.py.
        """
        results = []
        cache_hits = 0
        cache_misses = 0
        
        # Process each LRN, using cache to avoid duplicate API calls
        for lrn in lrns:
            if len(lrn) < 7:
                continue
                
            npa = lrn[0:3]
            nxx = lrn[3:6]
            block_id = lrn[6]
            
            # Create cache key from NPA-NXX-Block tuple
            cache_key = (npa, nxx, block_id)
            
            # Check cache first
            if cache_key in self._lerg6_cache:
                cache_hits += 1
                cached_record = self._lerg6_cache[cache_key]
                
                # Create result from cached data
                result = {
                    'LRN': lrn,
                    'OCN': cached_record.get('ocn'),
                    'SWITCH': cached_record.get('switch'),  # Keep as SWITCH for backward compatibility
                    'CREATION_DATE': cached_record.get('creation_date'),
                    'E_STATUS_DATE': cached_record.get('e_status_date'),
                    'LAST_MODIFIED': cached_record.get('last_modified'),
                    'LATA': cached_record.get('lata'),
                    'LATA_NAME': cached_record.get('lata_name'),
                    'AOCN': cached_record.get('aocn'),
                    'LOC_NAME': cached_record.get('loc_name'),
                    'LOC_STATE': cached_record.get('loc_state'),
                    'TANDEM': cached_record.get('TANDEM'),
                    'T_OCN': cached_record.get('T_OCN')
                }
                results.append(result)
                continue
                
            # Cache miss - need to query API
            cache_misses += 1
            
            try:
                # Query LERG_6 for this specific NPA-NXX-Block combination
                filters = {
                    'npa': npa,
                    'nxx': nxx,
                    'block_id': block_id
                }
                
                lerg6_response = self.simple_query(
                    'lerg_6',
                    fields=['npa', 'nxx', 'block_id', 'ocn', 'switch', 'creation_date',
                           'e_status_date', 'last_modified', 'lata', 'lata_name',
                           'aocn', 'loc_name', 'loc_state'],
                    filters=filters,
                    limit=1  # Should only return one record for specific NPA-NXX-Block
                )
                
                lerg6_data = lerg6_response.get('data', [])
                
                # Process result and cache it
                if lerg6_data:
                    record = lerg6_data[0]
                    
                    # Get switch/tandem info
                    switch_info = self._get_switch_tandem_info(record.get('switch'))
                    
                    # Store in cache with switch/tandem info included
                    cached_data = {
                        **record,
                        'TANDEM': switch_info.get('TANDEM'),
                        'T_OCN': switch_info.get('TANDEM_OCN')  # Store as T_OCN for consistency
                    }
                    self._lerg6_cache[cache_key] = cached_data
                    
                    # Create result
                    result = {
                        'LRN': lrn,
                        'OCN': record.get('ocn'),
                        'SWITCH': record.get('switch'),  # Keep as SWITCH for backward compatibility
                        'CREATION_DATE': record.get('creation_date'),
                        'E_STATUS_DATE': record.get('e_status_date'),
                        'LAST_MODIFIED': record.get('last_modified'),
                        'LATA': record.get('lata'),
                        'LATA_NAME': record.get('lata_name'),
                        'AOCN': record.get('aocn'),
                        'LOC_NAME': record.get('loc_name'),
                        'LOC_STATE': record.get('loc_state'),
                        'TANDEM': switch_info.get('TANDEM'),
                        'T_OCN': switch_info.get('TANDEM_OCN')
                    }
                    
                    results.append(result)
                    
            except Exception as e:
                logger.warning(f"Failed to get LERG data for LRN {lrn}: {e}")
                
        # Log cache statistics
        if lrns:
            total = cache_hits + cache_misses
            hit_rate = (cache_hits / total * 100) if total > 0 else 0
            logger.info(f"LERG cache: {cache_hits} hits, {cache_misses} misses ({hit_rate:.1f}% hit rate)")
                
        return results
        
    def discover_lrns_by_ocn(self, ocns: List[str]) -> List[str]:
        """
        Discover LRNs for given OCNs.
        Replaces the discover_lrns function in reverse.py.
        """
        lrns = []
        
        # Process each OCN separately using the GET endpoint
        for ocn in ocns:
            offset = 0
            limit = 1000
            
            while True:
                try:
                    # Use simple_query which uses the GET endpoint
                    response = self.simple_query(
                        'lerg12',
                        fields=['lrn'],
                        filters={'ocn': ocn},
                        limit=limit,
                        offset=offset
                    )
                    
                    data = response.get('data', [])
                    if not data:
                        break
                        
                    lrns.extend([record.get('lrn') for record in data if record.get('lrn')])
                    
                    if len(data) < limit:
                        break
                        
                    offset += limit
                    
                except Exception as e:
                    logger.warning(f"Failed to get LRNs for OCN {ocn}: {e}")
                    continue
            
        return lrns
        
    def get_tandem_ha_data(self, tandem: str = 'DNVRCO2630T') -> List[Dict[str, Any]]:
        """
        Get tandem HA data, similar to queryTandemHA.sql.
        """
        results = []
        
        # First get all switches that have this tandem
        offset = 0
        limit = 1000
        switches = []
        
        while True:
            try:
                sha_response = self.simple_query(
                    'lerg_7_sha',
                    fields=['switch', 'actual_sw_id'],
                    filters={'h_trm_d_tdm': tandem},
                    limit=limit,
                    offset=offset
                )
                
                sha_data = sha_response.get('data', [])
                switches.extend([(r.get('switch'), r.get('actual_sw_id')) 
                               for r in sha_data])
                
                if len(sha_data) < limit:
                    break
                    
                offset += limit
                
            except Exception as e:
                logger.warning(f"Failed to get switches for tandem {tandem}: {e}")
                break
        
        # For each switch, get the LERG_6 data
        for switch, actual in switches:
            try:
                # Query for switch and then filter by block_id='A' in post-processing
                lerg6_response = self.simple_query(
                    'lerg_6',
                    fields=['npa', 'nxx', 'block_id', 'ocn', 'lata', 'lata_name',
                           'creation_date', 'e_status_date', 'last_modified',
                           'aocn', 'loc_name', 'loc_state'],
                    filters={'switch': switch},
                    limit=1000
                )
                
                # Filter for block_id='A' records
                lerg6_data = [r for r in lerg6_response.get('data', []) 
                             if r.get('block_id') == 'A']
                
                for record in lerg6_data:
                    result = {
                        'NPANXX': f"{record.get('npa')}{record.get('nxx')}",
                        'POI': switch,
                        'POI_OCN': record.get('ocn'),
                        'ACTUAL': actual,
                        'TANDEM': tandem,
                        'LATA': record.get('lata'),
                        'LATA_NAME': record.get('lata_name'),
                        'CREATION_DATE': record.get('creation_date'),
                        'E_STATUS_DATE': record.get('e_status_date'),
                        'LAST_MODIFIED': record.get('last_modified'),
                        'AOCN': record.get('aocn'),
                        'LOC_NAME': record.get('loc_name'),
                        'LOC_STATE': record.get('loc_state')
                    }
                    
                    # Get OCN name
                    result['OCN_NAME'] = self._get_ocn_name(record.get('ocn'))
                    
                    # Get tandem OCN and name
                    tandem_info = self._get_switch_tandem_info(switch)
                    result['TANDEM_OCN'] = tandem_info.get('TANDEM_OCN')
                    result['TANDEM_NAME'] = tandem_info.get('TANDEM_NAME')
                    
                    results.append(result)
                    
            except Exception as e:
                logger.warning(f"Failed to get LERG_6 data for switch {switch}: {e}")
                
        return results
