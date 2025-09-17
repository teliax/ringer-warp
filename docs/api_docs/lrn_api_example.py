import asyncio
import logging
import time
import requests
import aiohttp
from datetime import datetime
import random
import os
import warnings
from collections import deque

from numberAudit.utils.cache import load_lrn_cache, save_lrn_cache

"""
LRN Lookup Module - Updated for Ringer API (TeliQue)

This module provides LRN (Local Routing Number) lookup functionality using the Ringer API.

CONFIGURATION:
- Endpoint: https://api-dev.ringer.tel/v1/telique/lrn/{number}
- Authentication: IP Whitelist (primary) + optional Bearer token
- Response Format: Plain text (LRN;SPID format, e.g., "8542850999;616J")
- Environment Variables:
  - RINGER_API_KEY (optional): Bearer token for additional authentication
  
MIGRATION FROM PREVIOUS SERVICE:
- Previous: http://lrn.infoserv.net:56660/{TN} 
- Current: https://api-dev.ringer.tel/v1/telique/lrn/{TN}
- Response format maintained for backward compatibility (LRN;SPID)

Example API call:
  curl https://api-dev.ringer.tel/v1/telique/lrn/8437763676
  8542850999;616J

For more information: https://docs.ringer.tel/docs/ringer/ringer
"""

# Global state for adaptive throttling
class AdaptiveThrottler:
    def __init__(self, window_size=100, success_threshold=0.95, initial_pause=0.2):
        self.window_size = window_size
        self.success_threshold = success_threshold
        self.results = deque(maxlen=window_size)  # 1 for success, 0 for failure
        self.pause_time = initial_pause
        self.min_pause = 0.05  # 50ms minimum pause
        self.max_pause = 1.0   # 1s maximum pause
        
    def record_result(self, success):
        """Record a success (True) or failure (False)"""
        self.results.append(1 if success else 0)
        self._adjust_throttling()
        
    def _adjust_throttling(self):
        """Adjust throttling based on recent results"""
        if len(self.results) < 10:  # Not enough data yet
            return
            
        # Calculate success rate
        success_rate = sum(self.results) / len(self.results)
        
        # Adjust pause time based on success rate
        if success_rate >= self.success_threshold:
            # Reduce pause time - go a bit faster (decrease by 10%)
            self.pause_time = max(self.min_pause, self.pause_time * 0.9)
        else:
            # Increase pause time - slow down (increase by 25%)
            self.pause_time = min(self.max_pause, self.pause_time * 1.25)
            
    def get_pause(self):
        """Get the current recommended pause time"""
        return self.pause_time
        
    def get_stats(self):
        """Get current statistics"""
        if not self.results:
            return 0.0, self.pause_time
            
        success_rate = sum(self.results) / len(self.results)
        return success_rate, self.pause_time

# Create a global throttler instance
throttler = AdaptiveThrottler()

# Synchronous version (kept for fallback)
def get_lrn(TN):
    """
    Synchronous version of LRN lookup - now using Ringer API
    
    Args:
        TN (str): Phone number to lookup
        
    Returns:
        requests.Response: Response from Ringer LRN service
    """
    # Updated to use Ringer API (TeliQue)
    url = f"https://api-dev.ringer.tel/v1/telique/lrn/{TN}"
    
    # Get API key from environment
    api_key = os.getenv('RINGER_API_KEY')
    
    # Prepare headers for Ringer API (plain text response)
    headers = {
        'User-Agent': 'NumberAudit/1.0'
    }
    
    # Add API key if available
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    
    while True:
        try:
            response = requests.get(url, headers=headers, timeout=10)
            return response
        except requests.exceptions.ConnectionError as conerr:
            logging.error('Got a connection error with Ringer API - trying again.')
            time.sleep(2)
            continue
        except requests.exceptions.Timeout as timeout:
            logging.error('Got a timeout error with Ringer API - trying again.')
            time.sleep(2)
            continue
        break

# Asynchronous LRN lookup - much faster for large volume
async def get_lrn_async(TN, session, lrn_cache=None):
    """
    Async version of get_lrn that supports caching - now using Ringer API
    
    Args:
        TN (str): Phone number to lookup
        session (aiohttp.ClientSession): HTTP session to use
        lrn_cache (dict, optional): LRN cache dictionary
        
    Returns:
        str: Response text from Ringer LRN service (formatted as LRN;SPID for compatibility)
    """
    global throttler
    
    if lrn_cache is not None and TN in lrn_cache:
        return lrn_cache[TN]
        
    # Updated to use Ringer API (TeliQue)
    # Format: https://api-dev.ringer.tel/v1/telique/lrn/{number}
    url = f"https://api-dev.ringer.tel/v1/telique/lrn/{TN}"
    
    # Get API key from environment for Ringer API
    api_key = os.getenv('RINGER_API_KEY')
    
    # Prepare headers for Ringer API (plain text response)
    headers = {
        'User-Agent': 'NumberAudit/1.0'
    }
    
    # Add API key if available (some Ringer deployments use API keys alongside IP whitelist)
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    
    max_retries = 5  # Increase from 3 to 5 to allow more attempts
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Use 10 second timeout for Ringer API - typically faster than previous service
            async with session.get(url, headers=headers, timeout=10) as response:
                if response.status != 200:
                    # Log HTTP error status
                    error_msg = f"HTTP {response.status}: {response.reason}"
                    logging.warning(f"Ringer API returned error for {TN}: {error_msg} (attempt {retry_count+1}/{max_retries})")
                    retry_count += 1
                    
                    # Record failure for adaptive throttling
                    throttler.record_result(False)
                    
                    # Add more exponential backoff with jitter
                    backoff_time = (2 ** retry_count) + (0.1 * random.random())
                    await asyncio.sleep(backoff_time)
                    continue
                    
                # Parse plain text response from Ringer API (same format as original)
                result = await response.text()
                
                # Clean up any trailing characters (like % or whitespace)
                result = result.strip()
                
                if not result or len(result) < 3:  # Check for empty or invalid response
                    logging.warning(f"Empty or invalid response for {TN}: '{result}' (attempt {retry_count+1}/{max_retries})")
                    retry_count += 1
                    
                    # Record failure for adaptive throttling
                    throttler.record_result(False)
                    
                    # Backoff
                    backoff_time = (2 ** retry_count) + (0.1 * random.random())
                    await asyncio.sleep(backoff_time)
                    continue
                
                if lrn_cache is not None:
                    lrn_cache[TN] = result
                
                # Record success for adaptive throttling
                throttler.record_result(True)
                    
                return result
                
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            retry_count += 1
            error_type = type(e).__name__
            error_msg = str(e) if str(e) else "No error details available"
            
            # Record failure for adaptive throttling
            throttler.record_result(False)
            
            if retry_count >= max_retries:
                logging.error(f"Failed to get LRN for {TN} after {max_retries} attempts: {error_type} - {error_msg}")
                return f"{TN};error"
                
            logging.warning(f"Ringer API LRN lookup error for {TN} (attempt {retry_count}/{max_retries}): {error_type} - {error_msg}")
            # Use exponential backoff with increased delay
            backoff_time = (2 ** retry_count) + (0.1 * random.random())
            await asyncio.sleep(backoff_time)
    
    # This should never be reached, but just in case
    return f"{TN};error"

async def batch_get_lrn(numbers, batch_size=500, max_concurrent=10):
    """
    Process a batch of phone numbers asynchronously for LRN lookups using Ringer API with adaptive performance optimization
    
    Args:
        numbers (list): List of phone numbers to process
        batch_size (int): Batch size for processing
        max_concurrent (int): Maximum concurrent requests
        
    Returns:
        dict: Dictionary of phone numbers to LRN responses (format: LRN;SPID)
    """
    global throttler
    start_time = time.time()
    lrn_cache = load_lrn_cache()
    results = {}
    
    # Track timing and statistics
    cache_hits = 0
    cache_misses = 0
    request_time = 0
    total_fetched = 0
    error_count = 0
    success_count = 0
    
    # Filter all numbers at once to improve efficiency
    to_fetch_all = [num for num in numbers if num not in lrn_cache]
    cache_hits = len(numbers) - len(to_fetch_all)
    cache_misses = len(to_fetch_all)
    
    # Add all cached results at once
    for num in numbers:
        if num in lrn_cache:
            results[num] = lrn_cache[num]
    
    if not to_fetch_all:
        end_time = time.time()
        logging.info(f"Ringer API LRN lookup completed: {cache_hits} cache hits, 0 requests, {end_time - start_time:.2f}s")
        return results
    
    # Set internal batch sizes - dynamically based on max_concurrent
    # Use a more aggressive strategy for large volumes
    internal_batch_size = max(10, min(max_concurrent * 2, 50))  # Between 10 and 50, scaling with max_concurrent
    
    # Set total concurrent requests to the lesser of batch_size or max_concurrent*5 (but at least max_concurrent)
    effective_max_concurrent = max(max_concurrent, min(batch_size, max_concurrent * 5))
    
    logging.info(f"Using internal_batch_size={internal_batch_size}, effective_max_concurrent={effective_max_concurrent}")
    
    # Process in multiple batches
    for i in range(0, len(to_fetch_all), batch_size):
        batch = to_fetch_all[i:i+batch_size]
        total_fetched += len(batch)
        batch_start_time = time.time()
        
        # Create a new connector for each major batch with optimized settings
        connector = aiohttp.TCPConnector(
            limit=effective_max_concurrent,
            ttl_dns_cache=300,
            force_close=False,  # Allow connection reuse
            enable_cleanup_closed=True  # Clean up closed connections
        )
        
        try:
            # Set balanced timeouts for better performance
            timeout = aiohttp.ClientTimeout(total=60, connect=5, sock_connect=5, sock_read=10)
            async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
                # Further split the batch into smaller chunks
                for j in range(0, len(batch), internal_batch_size):
                    sub_batch = batch[j:j+internal_batch_size]
                    
                    # Process with appropriate concurrency based on settings
                    if max_concurrent == 1:
                        # Sequential processing with adaptive pauses
                        for num in sub_batch:
                            request_start = time.time()
                            try:
                                result = await get_lrn_async(num, session, lrn_cache)
                                results[num] = result
                                if not result.endswith(';error'):
                                    success_count += 1
                                else:
                                    error_count += 1
                            except Exception as e:
                                error_count += 1
                                error_type = type(e).__name__
                                logging.error(f"Exception in LRN lookup for {num}: {error_type} - {str(e)}")
                                results[num] = f"{num};error"
                                
                                # Record failure in throttler
                                throttler.record_result(False)
                            
                            request_end = time.time()
                            request_time += (request_end - request_start)
                            
                            # Get adaptive pause based on recent performance
                            pause = throttler.get_pause()
                            success_rate, _ = throttler.get_stats()
                            
                            # Use a small adaptive pause between individual requests
                            await asyncio.sleep(pause)
                    else:
                        # Concurrent processing with bulk operations
                        request_start = time.time()
                        tasks = [get_lrn_async(num, session, lrn_cache) for num in sub_batch]
                        
                        try:
                            # Allow 10 seconds per number in the batch with a maximum of 60 seconds
                            timeout_value = min(60, max(10, internal_batch_size * 2))
                            batch_results = await asyncio.wait_for(
                                asyncio.gather(*tasks, return_exceptions=True), 
                                timeout=timeout_value
                            )
                            
                            # Process results
                            for num, result in zip(sub_batch, batch_results):
                                if isinstance(result, Exception):
                                    error_count += 1
                                    error_type = type(result).__name__
                                    logging.error(f"Exception in LRN lookup for {num}: {error_type} - {str(result)}")
                                    results[num] = f"{num};error"
                                    
                                    # Record failure in throttler
                                    throttler.record_result(False)
                                else:
                                    results[num] = result
                                    if not result.endswith(';error'):
                                        success_count += 1
                                        # Record success in throttler
                                        throttler.record_result(True)
                                    else:
                                        error_count += 1
                                        # Record failure in throttler
                                        throttler.record_result(False)
                                    
                        except asyncio.TimeoutError:
                            logging.error(f"Timeout waiting for sub-batch completion")
                            for num in sub_batch:
                                if num not in results:
                                    error_count += 1
                                    results[num] = f"{num};error"
                                    
                                    # Record failure in throttler
                                    throttler.record_result(False)
                        
                        request_end = time.time()
                        request_time += (request_end - request_start)
                    
                    # Adaptive pause between sub-batches based on success rate
                    success_rate, pause_time = throttler.get_stats()
                    pause = max(0.1, pause_time * 2)  # Between batches, pause at least 100ms
                    
                    if success_rate < 0.9:  # If success rate is below 90%, pause longer
                        pause = max(0.5, pause * 2)
                    
                    # Show throttling info every few batches
                    if j % (3 * internal_batch_size) == 0:
                        logging.info(f"Adaptive throttling: success_rate={success_rate:.2f}, pause={pause:.3f}s")
                    
                    await asyncio.sleep(pause)
                
                # Report progress for large batches
                if i + batch_size < len(to_fetch_all):
                    progress = (i + batch_size) / len(to_fetch_all) * 100
                    batch_elapsed = time.time() - batch_start_time
                    batch_rate = len(batch) / batch_elapsed if batch_elapsed > 0 else 0
                    logging.info(f"LRN lookup progress: {i + batch_size}/{len(to_fetch_all)} ({progress:.1f}%) - {batch_rate:.1f} lookups/sec")
        except Exception as e:
            logging.error(f"Unexpected error in batch processing: {type(e).__name__} - {str(e)}")
            # Mark remaining numbers in this batch as errors
            for num in batch:
                if num not in results:
                    error_count += 1
                    results[num] = f"{num};error"
                    
                    # Record failure in throttler
                    throttler.record_result(False)
        finally:
            # Ensure connector is closed
            await connector.close()
            
            # Adaptive pause between major batches
            success_rate, _ = throttler.get_stats()
            batch_pause = 0.5 if success_rate >= 0.95 else 1.0  # Short pause if success rate is high
            
            await asyncio.sleep(batch_pause)
    
    # Save updated cache
    save_lrn_cache(lrn_cache)
    
    # Calculate stats and timings
    end_time = time.time()
    total_time = end_time - start_time
    overhead_time = total_time - request_time
    
    # Calculate success rate
    success_rate = (success_count / cache_misses * 100) if cache_misses > 0 else 0
    
    # Log detailed statistics
    if total_fetched > 0:
        avg_time_per_request = request_time / total_fetched if total_fetched > 0 else 0
        logging.info(f"LRN lookup statistics:")
        logging.info(f"  Cache hits: {cache_hits}, Cache misses: {cache_misses}")
        logging.info(f"  Successful lookups: {success_count}/{cache_misses} ({success_rate:.1f}%)")
        logging.info(f"  Error count: {error_count}")
        logging.info(f"  Network request time: {request_time:.2f}s ({request_time/total_time*100:.1f}%)")
        logging.info(f"  Overhead time: {overhead_time:.2f}s ({overhead_time/total_time*100:.1f}%)")
        logging.info(f"  Avg time per request: {avg_time_per_request*1000:.2f}ms")
        logging.info(f"  Overall rate: {total_fetched/total_time:.1f} lookups/sec")
        logging.info(f"  Effective rate: {success_count/total_time:.1f} successful lookups/sec")
        logging.info(f"  Total time: {total_time:.2f}s")
        
        # Final adaptive throttling stats
        final_success_rate, final_pause = throttler.get_stats()
        logging.info(f"  Final throttling state: success_rate={final_success_rate:.2f}, pause={final_pause:.3f}s")
        
        # Print to console as well
        print(f"Ringer API LRN lookup completed: {cache_hits} cache hits, {cache_misses} requests ({success_count} successful, {error_count} errors), {total_time:.2f}s")
        print(f"  Success rate: {success_rate:.1f}%, Rate: {total_fetched/total_time:.1f} lookups/sec")
        if success_count > 0:
            print(f"  Avg time per lookup: {avg_time_per_request*1000:.2f}ms")
    
    return results

def process_lrn_result(lrn_response):
    """
    Process an LRN response and return LRN and SPID
    
    Args:
        lrn_response (str): Response from LRN service
        
    Returns:
        tuple: (lrn, spid) parsed from response
    """
    if not lrn_response or ';' not in lrn_response:
        return lrn_response, None
        
    parts = lrn_response.split(';')
    lrn = parts[0]
    spid = parts[1] if len(parts) > 1 else None
    
    return lrn, spid 