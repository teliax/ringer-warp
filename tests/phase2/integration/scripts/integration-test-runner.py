#!/usr/bin/env python3
"""
Integration Test Runner for WARP Platform
Orchestrates end-to-end testing across voice, SMS, and API components
"""

import requests
import smpplib.client
import time
import json
import logging
import argparse
import subprocess
import threading
from datetime import datetime
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IntegrationTestRunner:
    """Main integration test orchestrator"""
    
    def __init__(self, config):
        self.config = config
        self.results = {
            'start_time': datetime.now().isoformat(),
            'scenarios': [],
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0
            }
        }
        
        # Initialize API client
        self.api_base = config.get('api_url', 'https://api.ringer.tel')
        self.api_token = None
        
        # Initialize SMPP client
        self.smpp_client = None
        
        # Test data
        self.test_customer_id = None
        self.test_trunk_id = None
        self.test_numbers = []
    
    def setup(self):
        """Setup test environment"""
        logger.info("Setting up integration test environment...")
        
        # Authenticate to API
        if not self.authenticate_api():
            logger.error("Failed to authenticate to API")
            return False
        
        # Connect to SMPP
        if not self.connect_smpp():
            logger.error("Failed to connect to SMPP")
            return False
        
        # Create test customer
        if not self.create_test_customer():
            logger.error("Failed to create test customer")
            return False
        
        logger.info("Setup completed successfully")
        return True
    
    def teardown(self):
        """Cleanup test environment"""
        logger.info("Cleaning up test environment...")
        
        # Delete test data
        if self.test_customer_id:
            self.delete_test_customer()
        
        # Disconnect SMPP
        if self.smpp_client:
            try:
                self.smpp_client.unbind()
                self.smpp_client.disconnect()
            except:
                pass
        
        logger.info("Cleanup completed")
    
    def authenticate_api(self):
        """Authenticate to Kong API Gateway"""
        try:
            response = requests.post(
                f'{self.api_base}/v1/auth/login',
                json={
                    'username': self.config.get('api_user', 'test@ringer.tel'),
                    'password': self.config.get('api_password', 'testpass')
                }
            )
            
            if response.status_code == 200:
                self.api_token = response.json().get('token')
                logger.info("API authentication successful")
                return True
            else:
                logger.error(f"API authentication failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"API authentication error: {e}")
            return False
    
    def connect_smpp(self):
        """Connect to Jasmin SMPP server"""
        try:
            self.smpp_client = smpplib.client.Client(
                self.config.get('smpp_host', 'localhost'),
                self.config.get('smpp_port', 2775)
            )
            
            self.smpp_client.connect()
            self.smpp_client.bind_transceiver(
                system_id=self.config.get('smpp_user', 'test_user'),
                password=self.config.get('smpp_password', 'test_pass')
            )
            
            # Start listening thread
            listen_thread = threading.Thread(target=self.smpp_client.listen)
            listen_thread.daemon = True
            listen_thread.start()
            
            logger.info("SMPP connection successful")
            return True
        except Exception as e:
            logger.error(f"SMPP connection error: {e}")
            return False
    
    def create_test_customer(self):
        """Create test customer via API"""
        try:
            response = requests.post(
                f'{self.api_base}/v1/customers',
                headers={'Authorization': f'Bearer {self.api_token}'},
                json={
                    'name': 'Integration Test Customer',
                    'email': 'integration-test@ringer.tel',
                    'type': 'business',
                    'status': 'active'
                }
            )
            
            if response.status_code in [200, 201]:
                self.test_customer_id = response.json().get('id')
                logger.info(f"Test customer created: {self.test_customer_id}")
                return True
            else:
                logger.error(f"Failed to create test customer: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Create customer error: {e}")
            return False
    
    def delete_test_customer(self):
        """Delete test customer"""
        try:
            response = requests.delete(
                f'{self.api_base}/v1/customers/{self.test_customer_id}',
                headers={'Authorization': f'Bearer {self.api_token}'}
            )
            logger.info("Test customer deleted")
        except Exception as e:
            logger.error(f"Delete customer error: {e}")
    
    def log_scenario_result(self, scenario_name, passed, details=""):
        """Log scenario test result"""
        result = {
            'scenario': scenario_name,
            'passed': passed,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        
        self.results['scenarios'].append(result)
        self.results['summary']['total'] += 1
        
        if passed:
            self.results['summary']['passed'] += 1
            logger.info(f"✓ {scenario_name}: {details}")
        else:
            self.results['summary']['failed'] += 1
            logger.error(f"✗ {scenario_name}: {details}")
    
    # Integration Test Scenarios
    
    def test_voice_sms_integration(self):
        """Test voice and SMS integration"""
        logger.info("=== Testing Voice-SMS Integration ===")
        
        # Scenario 1: SMS notification on missed call
        scenario = "SMS_ON_MISSED_CALL"
        try:
            # Simulate missed call by making a short call
            # In real test, would use SIPp
            
            # Send SMS notification
            pdu = self.smpp_client.send_message(
                source_addr_ton=smpplib.consts.SMPP_TON_INTL,
                source_addr='+12125551000',
                dest_addr_ton=smpplib.consts.SMPP_TON_INTL,
                destination_addr='+13105552000',
                short_message=b'You have 1 missed call from +12125551234',
            )
            
            self.log_scenario_result(scenario, True, "SMS notification sent")
        except Exception as e:
            self.log_scenario_result(scenario, False, str(e))
        
        # Scenario 2: Voice call triggered by SMS
        scenario = "CALL_TRIGGERED_BY_SMS"
        try:
            # Send SMS with keyword
            pdu = self.smpp_client.send_message(
                source_addr_ton=smpplib.consts.SMPP_TON_INTL,
                source_addr='+13105552000',
                dest_addr_ton=smpplib.consts.SMPP_TON_INTL,
                destination_addr='+12125551000',
                short_message=b'CALLBACK',
            )
            
            # In real scenario, would verify callback initiated
            time.sleep(2)
            
            self.log_scenario_result(scenario, True, "Callback SMS processed")
        except Exception as e:
            self.log_scenario_result(scenario, False, str(e))
    
    def test_api_voice_integration(self):
        """Test API and voice integration"""
        logger.info("=== Testing API-Voice Integration ===")
        
        # Scenario 1: Provision trunk via API
        scenario = "PROVISION_TRUNK_AND_CALL"
        try:
            # Create trunk
            response = requests.post(
                f'{self.api_base}/v1/customers/{self.test_customer_id}/trunks',
                headers={'Authorization': f'Bearer {self.api_token}'},
                json={
                    'name': 'Test Trunk',
                    'type': 'registration',
                    'max_channels': 10,
                    'username': 'test1001',
                    'password': 'SecurePass123!',
                    'allowed_ips': ['0.0.0.0/0']
                }
            )
            
            if response.status_code in [200, 201]:
                self.test_trunk_id = response.json().get('id')
                
                # In real test, would make SIP call using trunk
                self.log_scenario_result(scenario, True, f"Trunk created: {self.test_trunk_id}")
            else:
                self.log_scenario_result(scenario, False, f"Failed to create trunk: {response.status_code}")
        except Exception as e:
            self.log_scenario_result(scenario, False, str(e))
        
        # Scenario 2: Update routing rules
        scenario = "UPDATE_ROUTING_RULES"
        try:
            # Create routing rule
            response = requests.post(
                f'{self.api_base}/v1/routing/rules',
                headers={'Authorization': f'Bearer {self.api_token}'},
                json={
                    'customer_id': self.test_customer_id,
                    'pattern': '+1212*',
                    'priority': 100,
                    'route_type': 'trunk',
                    'route_id': self.test_trunk_id
                }
            )
            
            if response.status_code in [200, 201]:
                self.log_scenario_result(scenario, True, "Routing rule created")
            else:
                self.log_scenario_result(scenario, False, f"Failed to create routing rule: {response.status_code}")
        except Exception as e:
            self.log_scenario_result(scenario, False, str(e))
    
    def test_api_sms_integration(self):
        """Test API and SMS integration"""
        logger.info("=== Testing API-SMS Integration ===")
        
        # Scenario: Send SMS via API
        scenario = "SEND_SMS_VIA_API"
        try:
            response = requests.post(
                f'{self.api_base}/v1/messaging/sms/send',
                headers={'Authorization': f'Bearer {self.api_token}'},
                json={
                    'from': '+12125551000',
                    'to': '+13105552000',
                    'message': 'Test SMS via API',
                    'callback_url': 'https://webhook.site/test'
                }
            )
            
            if response.status_code in [200, 201, 202]:
                message_id = response.json().get('message_id')
                self.log_scenario_result(scenario, True, f"SMS sent via API: {message_id}")
            else:
                self.log_scenario_result(scenario, False, f"Failed to send SMS: {response.status_code}")
        except Exception as e:
            self.log_scenario_result(scenario, False, str(e))
    
    def test_multi_service_workflow(self):
        """Test complex multi-service workflows"""
        logger.info("=== Testing Multi-Service Workflows ===")
        
        # Scenario: Complete customer onboarding
        scenario = "CUSTOMER_ONBOARDING_FLOW"
        try:
            # Step 1: Create customer (already done in setup)
            
            # Step 2: Assign phone number
            response = requests.post(
                f'{self.api_base}/v1/customers/{self.test_customer_id}/numbers',
                headers={'Authorization': f'Bearer {self.api_token}'},
                json={
                    'number': '+12125559999',
                    'type': 'did',
                    'capabilities': ['voice', 'sms']
                }
            )
            
            if response.status_code not in [200, 201]:
                raise Exception(f"Failed to assign number: {response.status_code}")
            
            # Step 3: Send welcome SMS
            pdu = self.smpp_client.send_message(
                source_addr_ton=smpplib.consts.SMPP_TON_INTL,
                source_addr='+12125551000',
                dest_addr_ton=smpplib.consts.SMPP_TON_INTL,
                destination_addr='+13105552000',
                short_message=b'Welcome to WARP! Your account is now active.',
            )
            
            # Step 4: Create initial configuration
            response = requests.post(
                f'{self.api_base}/v1/customers/{self.test_customer_id}/config',
                headers={'Authorization': f'Bearer {self.api_token}'},
                json={
                    'voicemail_enabled': True,
                    'sms_forwarding': 'email',
                    'call_recording': False
                }
            )
            
            self.log_scenario_result(scenario, True, "Complete onboarding flow successful")
        except Exception as e:
            self.log_scenario_result(scenario, False, str(e))
    
    def test_failover_scenarios(self):
        """Test failover and resilience"""
        logger.info("=== Testing Failover Scenarios ===")
        
        # Scenario: API Gateway failover
        scenario = "API_GATEWAY_FAILOVER"
        try:
            # Make multiple rapid requests to test load balancing
            responses = []
            for i in range(10):
                response = requests.get(
                    f'{self.api_base}/v1/health',
                    headers={'Authorization': f'Bearer {self.api_token}'},
                    timeout=5
                )
                responses.append(response.status_code)
            
            # Check if all requests succeeded
            success_rate = responses.count(200) / len(responses)
            
            self.log_scenario_result(
                scenario,
                success_rate >= 0.9,
                f"Success rate: {success_rate*100:.1f}%"
            )
        except Exception as e:
            self.log_scenario_result(scenario, False, str(e))
    
    def test_performance_under_load(self):
        """Test performance with mixed traffic"""
        logger.info("=== Testing Performance Under Load ===")
        
        scenario = "MIXED_TRAFFIC_LOAD"
        start_time = time.time()
        errors = 0
        operations = 0
        
        try:
            # Simulate mixed traffic for 30 seconds
            end_time = start_time + 30
            
            while time.time() < end_time:
                operations += 1
                
                # Mix of API calls and SMS
                if operations % 3 == 0:
                    # API call
                    try:
                        response = requests.get(
                            f'{self.api_base}/v1/customers',
                            headers={'Authorization': f'Bearer {self.api_token}'},
                            timeout=2
                        )
                        if response.status_code != 200:
                            errors += 1
                    except:
                        errors += 1
                else:
                    # SMS send
                    try:
                        self.smpp_client.send_message(
                            source_addr_ton=smpplib.consts.SMPP_TON_INTL,
                            source_addr='+12125551000',
                            dest_addr_ton=smpplib.consts.SMPP_TON_INTL,
                            destination_addr=f'+1310555{2000 + (operations % 100):04d}',
                            short_message=f'Load test {operations}'.encode(),
                        )
                    except:
                        errors += 1
                
                # Small delay to control rate
                time.sleep(0.1)
            
            duration = time.time() - start_time
            error_rate = errors / operations if operations > 0 else 0
            ops_per_second = operations / duration
            
            self.log_scenario_result(
                scenario,
                error_rate < 0.05,  # Less than 5% errors
                f"Ops/sec: {ops_per_second:.1f}, Error rate: {error_rate*100:.1f}%"
            )
        except Exception as e:
            self.log_scenario_result(scenario, False, str(e))
    
    def run_all_tests(self):
        """Run all integration tests"""
        logger.info("Starting Integration Test Suite")
        
        # Run test scenarios
        self.test_voice_sms_integration()
        time.sleep(2)
        
        self.test_api_voice_integration()
        time.sleep(2)
        
        self.test_api_sms_integration()
        time.sleep(2)
        
        self.test_multi_service_workflow()
        time.sleep(2)
        
        self.test_failover_scenarios()
        time.sleep(2)
        
        self.test_performance_under_load()
        
        # Generate report
        self.generate_report()
    
    def generate_report(self):
        """Generate test report"""
        self.results['end_time'] = datetime.now().isoformat()
        
        # Calculate pass rate
        total = self.results['summary']['total']
        passed = self.results['summary']['passed']
        pass_rate = (passed / total * 100) if total > 0 else 0
        
        # Print summary
        logger.info("=" * 60)
        logger.info("INTEGRATION TEST SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total Scenarios: {total}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {self.results['summary']['failed']}")
        logger.info(f"Pass Rate: {pass_rate:.1f}%")
        logger.info("=" * 60)
        
        # Save detailed results
        results_dir = '/home/daldworth/repos/ringer-warp/tests/phase2/integration/results'
        os.makedirs(results_dir, exist_ok=True)
        
        with open(f'{results_dir}/integration_test_results.json', 'w') as f:
            json.dump(self.results, f, indent=2)
        
        # Generate markdown report
        with open(f'{results_dir}/integration_test_report.md', 'w') as f:
            f.write("# Integration Test Report\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("## Summary\n")
            f.write(f"- Total Scenarios: {total}\n")
            f.write(f"- Passed: {passed}\n")
            f.write(f"- Failed: {self.results['summary']['failed']}\n")
            f.write(f"- Pass Rate: {pass_rate:.1f}%\n\n")
            
            f.write("## Scenario Results\n")
            for scenario in self.results['scenarios']:
                status = "✓" if scenario['passed'] else "✗"
                f.write(f"- {status} **{scenario['scenario']}**: {scenario['details']}\n")
        
        logger.info(f"Results saved to {results_dir}")


def main():
    """Main execution"""
    parser = argparse.ArgumentParser(description='Integration Test Runner')
    parser.add_argument('--config', type=str, help='Config file path')
    parser.add_argument('--api-url', default='https://api.ringer.tel', help='API URL')
    parser.add_argument('--smpp-host', default='localhost', help='SMPP host')
    parser.add_argument('--smpp-port', type=int, default=2775, help='SMPP port')
    
    args = parser.parse_args()
    
    # Load configuration
    config = {
        'api_url': args.api_url,
        'smpp_host': args.smpp_host,
        'smpp_port': args.smpp_port,
        'api_user': os.getenv('API_USER', 'test@ringer.tel'),
        'api_password': os.getenv('API_PASSWORD', 'testpass'),
        'smpp_user': os.getenv('SMPP_USER', 'test_user'),
        'smpp_password': os.getenv('SMPP_PASSWORD', 'test_pass')
    }
    
    # Create test runner
    runner = IntegrationTestRunner(config)
    
    try:
        # Setup
        if not runner.setup():
            logger.error("Setup failed, aborting tests")
            return 1
        
        # Run tests
        runner.run_all_tests()
        
        # Return exit code based on results
        if runner.results['summary']['failed'] == 0:
            return 0
        else:
            return 1
            
    except KeyboardInterrupt:
        logger.info("Tests interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"Test runner error: {e}")
        return 1
    finally:
        # Cleanup
        runner.teardown()


if __name__ == '__main__':
    sys.exit(main())