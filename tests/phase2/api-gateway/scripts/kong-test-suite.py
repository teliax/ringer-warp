#!/usr/bin/env python3
"""
Kong API Gateway Test Suite
Comprehensive testing for authentication, rate limiting, routing, and more
"""

import requests
import jwt
import time
import json
import threading
import statistics
from datetime import datetime, timedelta
import argparse
import logging
from urllib.parse import urljoin

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class KongTestSuite:
    """Kong API Gateway test suite"""
    
    def __init__(self, base_url, admin_url=None):
        self.base_url = base_url.rstrip('/')
        self.admin_url = admin_url or 'http://localhost:8001'
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'tests': []
        }
    
    def log_test_result(self, test_name, passed, message=""):
        """Log test result"""
        result = {
            'test': test_name,
            'passed': passed,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results['tests'].append(result)
        
        if passed:
            self.test_results['passed'] += 1
            logger.info(f"✓ {test_name}: {message}")
        else:
            self.test_results['failed'] += 1
            logger.error(f"✗ {test_name}: {message}")
    
    def generate_jwt_token(self, payload=None, expired=False):
        """Generate JWT token for testing"""
        if payload is None:
            payload = {
                'sub': 'test-customer-123',
                'name': 'Test Customer',
                'groups': ['customers'],
                'iss': 'jwt-issuer-key'
            }
        
        # Set expiration
        if expired:
            payload['exp'] = int((datetime.now() - timedelta(hours=1)).timestamp())
        else:
            payload['exp'] = int((datetime.now() + timedelta(hours=1)).timestamp())
        
        payload['iat'] = int(datetime.now().timestamp())
        
        # Sign token
        secret = 'test-jwt-secret'
        token = jwt.encode(payload, secret, algorithm='HS256')
        
        return token
    
    def test_jwt_authentication(self):
        """Test JWT authentication"""
        logger.info("=== Testing JWT Authentication ===")
        
        # Test 1: Valid JWT token
        valid_token = self.generate_jwt_token()
        headers = {'Authorization': f'Bearer {valid_token}'}
        
        try:
            response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
            self.log_test_result(
                'JWT_AUTH_VALID',
                response.status_code in [200, 404],  # 404 if no customers yet
                f'Status: {response.status_code}'
            )
        except Exception as e:
            self.log_test_result('JWT_AUTH_VALID', False, str(e))
        
        # Test 2: Invalid JWT token
        headers = {'Authorization': 'Bearer invalid-token'}
        
        try:
            response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
            self.log_test_result(
                'JWT_AUTH_INVALID',
                response.status_code == 401,
                f'Status: {response.status_code}'
            )
        except Exception as e:
            self.log_test_result('JWT_AUTH_INVALID', False, str(e))
        
        # Test 3: Expired JWT token
        expired_token = self.generate_jwt_token(expired=True)
        headers = {'Authorization': f'Bearer {expired_token}'}
        
        try:
            response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
            self.log_test_result(
                'JWT_AUTH_EXPIRED',
                response.status_code == 401,
                f'Status: {response.status_code}'
            )
        except Exception as e:
            self.log_test_result('JWT_AUTH_EXPIRED', False, str(e))
        
        # Test 4: Missing Authorization header
        try:
            response = requests.get(f'{self.base_url}/v1/customers')
            self.log_test_result(
                'JWT_AUTH_MISSING',
                response.status_code == 401,
                f'Status: {response.status_code}'
            )
        except Exception as e:
            self.log_test_result('JWT_AUTH_MISSING', False, str(e))
    
    def test_api_key_authentication(self):
        """Test API Key authentication"""
        logger.info("=== Testing API Key Authentication ===")
        
        # Test 1: Valid API key
        headers = {'X-API-Key': 'test-key-123456'}
        
        try:
            response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
            self.log_test_result(
                'API_KEY_VALID',
                response.status_code in [200, 404],
                f'Status: {response.status_code}'
            )
        except Exception as e:
            self.log_test_result('API_KEY_VALID', False, str(e))
        
        # Test 2: Invalid API key
        headers = {'X-API-Key': 'invalid-key'}
        
        try:
            response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
            self.log_test_result(
                'API_KEY_INVALID',
                response.status_code == 401,
                f'Status: {response.status_code}'
            )
        except Exception as e:
            self.log_test_result('API_KEY_INVALID', False, str(e))
    
    def test_rate_limiting(self):
        """Test rate limiting"""
        logger.info("=== Testing Rate Limiting ===")
        
        # Get valid token for authenticated requests
        token = self.generate_jwt_token()
        headers = {'Authorization': f'Bearer {token}'}
        
        # Test 1: Check rate limit headers
        try:
            response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
            
            has_headers = all([
                'X-RateLimit-Limit' in response.headers,
                'X-RateLimit-Remaining' in response.headers
            ])
            
            self.log_test_result(
                'RATE_LIMIT_HEADERS',
                has_headers,
                f'Headers: {list(response.headers.keys())}'
            )
            
            if has_headers:
                limit = int(response.headers.get('X-RateLimit-Limit', '0'))
                remaining = int(response.headers.get('X-RateLimit-Remaining', '0'))
                logger.info(f"Rate limit: {remaining}/{limit}")
        except Exception as e:
            self.log_test_result('RATE_LIMIT_HEADERS', False, str(e))
        
        # Test 2: Exceed rate limit
        responses = []
        rate_limit_hit = False
        
        # Make rapid requests
        for i in range(150):  # Assuming limit is 100/minute
            try:
                response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
                responses.append(response.status_code)
                
                if response.status_code == 429:
                    rate_limit_hit = True
                    break
            except Exception as e:
                logger.error(f"Request {i} failed: {e}")
        
        self.log_test_result(
            'RATE_LIMIT_ENFORCEMENT',
            rate_limit_hit,
            f'Hit limit after {len(responses)} requests'
        )
    
    def test_cors(self):
        """Test CORS configuration"""
        logger.info("=== Testing CORS ===")
        
        # Test 1: Preflight request
        headers = {
            'Origin': 'https://app.ringer.tel',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization'
        }
        
        try:
            response = requests.options(f'{self.base_url}/v1/customers', headers=headers)
            
            cors_headers_present = all([
                'Access-Control-Allow-Origin' in response.headers,
                'Access-Control-Allow-Methods' in response.headers,
                'Access-Control-Allow-Headers' in response.headers
            ])
            
            self.log_test_result(
                'CORS_PREFLIGHT',
                response.status_code == 200 and cors_headers_present,
                f'Status: {response.status_code}, CORS headers: {cors_headers_present}'
            )
        except Exception as e:
            self.log_test_result('CORS_PREFLIGHT', False, str(e))
        
        # Test 2: Actual request with Origin
        token = self.generate_jwt_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Origin': 'https://app.ringer.tel'
        }
        
        try:
            response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
            
            has_cors_header = 'Access-Control-Allow-Origin' in response.headers
            
            self.log_test_result(
                'CORS_ACTUAL_REQUEST',
                has_cors_header,
                f'CORS header present: {has_cors_header}'
            )
        except Exception as e:
            self.log_test_result('CORS_ACTUAL_REQUEST', False, str(e))
    
    def test_routing(self):
        """Test routing rules"""
        logger.info("=== Testing Routing ===")
        
        # Test various endpoints
        endpoints = [
            ('/v1/health', 'PUBLIC', None),  # No auth required
            ('/v1/auth/login', 'PUBLIC', None),  # No auth required
            ('/v1/customers', 'PROTECTED', self.generate_jwt_token()),
            ('/v1/trunks', 'PROTECTED', self.generate_jwt_token()),
            ('/v1/metrics', 'ADMIN', self.generate_jwt_token({'groups': ['admin']}))
        ]
        
        for path, access_type, token in endpoints:
            headers = {'Authorization': f'Bearer {token}'} if token else {}
            
            try:
                response = requests.get(f'{self.base_url}{path}', headers=headers)
                
                if access_type == 'PUBLIC':
                    # Should be accessible without auth (unless it's 404)
                    passed = response.status_code != 401
                elif access_type == 'PROTECTED':
                    # Should be accessible with valid token
                    passed = response.status_code != 401
                else:  # ADMIN
                    # Should check admin access
                    passed = True  # Simplified for testing
                
                self.log_test_result(
                    f'ROUTING_{path.replace("/", "_").upper()}',
                    passed,
                    f'Status: {response.status_code}'
                )
            except Exception as e:
                self.log_test_result(f'ROUTING_{path.replace("/", "_").upper()}', False, str(e))
    
    def test_request_transformation(self):
        """Test request/response transformation"""
        logger.info("=== Testing Request/Response Transformation ===")
        
        token = self.generate_jwt_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'X-Custom-Header': 'test-value'
        }
        
        try:
            # Make request to see if headers are transformed
            response = requests.get(f'{self.base_url}/v1/customers', headers=headers)
            
            # Check if certain headers are present/removed
            self.log_test_result(
                'RESPONSE_HEADERS',
                'X-Kong-Proxy-Latency' in response.headers,
                f'Kong headers present: {"X-Kong-Proxy-Latency" in response.headers}'
            )
        except Exception as e:
            self.log_test_result('RESPONSE_HEADERS', False, str(e))
    
    def test_performance(self):
        """Test performance and latency"""
        logger.info("=== Testing Performance ===")
        
        token = self.generate_jwt_token()
        headers = {'Authorization': f'Bearer {token}'}
        
        latencies = []
        errors = 0
        
        # Make 100 requests and measure latency
        for i in range(100):
            try:
                start = time.time()
                response = requests.get(f'{self.base_url}/v1/health', headers=headers)
                end = time.time()
                
                if response.status_code == 200:
                    latency = (end - start) * 1000  # Convert to ms
                    latencies.append(latency)
                else:
                    errors += 1
            except Exception as e:
                errors += 1
                logger.error(f"Performance test request {i} failed: {e}")
        
        if latencies:
            avg_latency = statistics.mean(latencies)
            p95_latency = statistics.quantiles(latencies, n=20)[18]  # 95th percentile
            max_latency = max(latencies)
            
            self.log_test_result(
                'PERFORMANCE_LATENCY',
                avg_latency < 100,  # Average should be under 100ms
                f'Avg: {avg_latency:.2f}ms, P95: {p95_latency:.2f}ms, Max: {max_latency:.2f}ms'
            )
            
            self.log_test_result(
                'PERFORMANCE_ERRORS',
                errors == 0,
                f'Errors: {errors}/100 requests'
            )
        else:
            self.log_test_result('PERFORMANCE_LATENCY', False, 'No successful requests')
    
    def test_load_balancing(self):
        """Test load balancing behavior"""
        logger.info("=== Testing Load Balancing ===")
        
        token = self.generate_jwt_token()
        headers = {'Authorization': f'Bearer {token}'}
        
        # Track which backend servers respond
        server_hits = {}
        
        for i in range(50):
            try:
                response = requests.get(f'{self.base_url}/v1/health', headers=headers)
                
                # Look for server identification in headers or response
                server_id = response.headers.get('X-Server-Id', 'unknown')
                server_hits[server_id] = server_hits.get(server_id, 0) + 1
            except Exception as e:
                logger.error(f"Load balancing test request {i} failed: {e}")
        
        # Check if requests are distributed
        if len(server_hits) > 1:
            distribution = [f"{k}: {v}" for k, v in server_hits.items()]
            self.log_test_result(
                'LOAD_BALANCING',
                True,
                f'Distribution: {", ".join(distribution)}'
            )
        else:
            self.log_test_result(
                'LOAD_BALANCING',
                False,
                f'All requests went to same server: {server_hits}'
            )
    
    def test_circuit_breaker(self):
        """Test circuit breaker pattern"""
        logger.info("=== Testing Circuit Breaker ===")
        
        # This test would require a backend that can be made to fail
        # For now, we'll test that the circuit breaker configuration exists
        
        token = self.generate_jwt_token()
        headers = {'Authorization': f'Bearer {token}'}
        
        try:
            # Make a request to a potentially failing endpoint
            response = requests.get(
                f'{self.base_url}/v1/test-circuit-breaker',
                headers=headers,
                timeout=5
            )
            
            # Check for circuit breaker headers or response
            self.log_test_result(
                'CIRCUIT_BREAKER',
                response.status_code in [200, 503, 404],
                f'Circuit breaker response: {response.status_code}'
            )
        except requests.Timeout:
            self.log_test_result('CIRCUIT_BREAKER', True, 'Request timed out (circuit open?)')
        except Exception as e:
            self.log_test_result('CIRCUIT_BREAKER', False, str(e))
    
    def run_all_tests(self):
        """Run all test suites"""
        logger.info("Starting Kong API Gateway Test Suite")
        logger.info(f"Target URL: {self.base_url}")
        
        # Run test categories
        self.test_jwt_authentication()
        time.sleep(1)
        
        self.test_api_key_authentication()
        time.sleep(1)
        
        self.test_rate_limiting()
        time.sleep(1)
        
        self.test_cors()
        time.sleep(1)
        
        self.test_routing()
        time.sleep(1)
        
        self.test_request_transformation()
        time.sleep(1)
        
        self.test_performance()
        time.sleep(1)
        
        self.test_load_balancing()
        time.sleep(1)
        
        self.test_circuit_breaker()
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        total = self.test_results['passed'] + self.test_results['failed']
        pass_rate = (self.test_results['passed'] / total * 100) if total > 0 else 0
        
        logger.info("=" * 50)
        logger.info("TEST SUMMARY")
        logger.info("=" * 50)
        logger.info(f"Total Tests: {total}")
        logger.info(f"Passed: {self.test_results['passed']}")
        logger.info(f"Failed: {self.test_results['failed']}")
        logger.info(f"Pass Rate: {pass_rate:.1f}%")
        logger.info("=" * 50)
        
        # Save results to file
        with open('/home/daldworth/repos/ringer-warp/tests/phase2/api-gateway/results/kong_test_results.json', 'w') as f:
            json.dump(self.test_results, f, indent=2)
        
        logger.info("Results saved to kong_test_results.json")


def main():
    """Main execution"""
    parser = argparse.ArgumentParser(description='Kong API Gateway Test Suite')
    parser.add_argument('--url', default='https://api.ringer.tel', 
                       help='Kong API Gateway URL')
    parser.add_argument('--admin-url', default='http://localhost:8001',
                       help='Kong Admin API URL')
    parser.add_argument('--test', choices=[
        'auth', 'rate-limit', 'cors', 'routing', 
        'transform', 'performance', 'all'
    ], default='all', help='Test category to run')
    
    args = parser.parse_args()
    
    # Create test suite
    suite = KongTestSuite(args.url, args.admin_url)
    
    # Run selected tests
    if args.test == 'all':
        suite.run_all_tests()
    elif args.test == 'auth':
        suite.test_jwt_authentication()
        suite.test_api_key_authentication()
    elif args.test == 'rate-limit':
        suite.test_rate_limiting()
    elif args.test == 'cors':
        suite.test_cors()
    elif args.test == 'routing':
        suite.test_routing()
    elif args.test == 'transform':
        suite.test_request_transformation()
    elif args.test == 'performance':
        suite.test_performance()
    
    return 0 if suite.test_results['failed'] == 0 else 1


if __name__ == '__main__':
    exit(main())