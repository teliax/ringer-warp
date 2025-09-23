# Phase 2 Testing Framework

This directory contains comprehensive test suites for all Phase 2 components of the WARP platform.

## Test Categories

### 1. Voice Testing (`/voice`)
- **SIP Registration**: Basic and authenticated registration scenarios
- **Call Setup**: INVITE/BYE flows with media validation
- **Media Testing**: RTP stream verification, codec negotiation
- **DTMF Testing**: RFC 2833 DTMF detection
- **Load Testing**: Concurrent call capacity and call setup rates

**Tools**: SIPp, RTPEngine CLI, custom Python scripts

### 2. SMS Testing (`/sms`)
- **SMPP Testing**: Connection, message delivery, delivery reports
- **HTTP API Testing**: Send SMS, bulk messaging, rate checking
- **Message Types**: ASCII, Unicode, multi-part, flash SMS
- **Routing Tests**: Static and dynamic routing validation
- **Load Testing**: Bulk SMS throughput testing

**Tools**: Python smpplib, curl, custom test clients

### 3. API Gateway Testing (`/api-gateway`)
- **Authentication**: JWT and API key validation
- **Authorization**: ACL and permission testing
- **Rate Limiting**: Global and per-consumer limits
- **CORS**: Preflight and actual request handling
- **Performance**: Latency and throughput testing

**Tools**: Python requests, k6, Postman

### 4. Integration Testing (`/integration`)
- **End-to-End Scenarios**: Complete customer workflows
- **Cross-Service Integration**: Voice+SMS, API+Voice, etc.
- **Failover Testing**: Service resilience validation
- **Data Consistency**: Cross-service data validation

**Tools**: Custom Python orchestration framework

### 5. Load Testing (`/load-testing`)
- **k6 Scenarios**: Mixed traffic patterns
- **Stress Testing**: Finding breaking points
- **Soak Testing**: Long-duration stability
- **Spike Testing**: Burst traffic handling

**Tools**: k6, custom monitoring scripts

## Quick Start

### Prerequisites

```bash
# Install required tools
sudo apt-get update
sudo apt-get install -y python3 python3-pip curl jq

# Python dependencies
pip3 install smpplib requests PyJWT

# Install SIPp (for voice testing)
sudo apt-get install -y sipp

# Install k6 (for load testing)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Running Individual Test Suites

```bash
# Voice tests
./voice/scripts/run-voice-tests.sh

# SMS SMPP tests
./sms/scripts/smpp-test-client.py --test all

# SMS HTTP API tests
./sms/scripts/http-api-test.sh

# API Gateway tests
./api-gateway/scripts/kong-test-suite.py --test all

# Integration tests
./integration/scripts/integration-test-runner.py

# Load tests
./load-testing/run-load-tests.sh
```

### Running All Tests

```bash
# Run complete test suite
./run-all-tests.sh

# Results will be saved to:
# ./results/test-run-YYYYMMDD_HHMMSS/
```

## Configuration

### Environment Variables

```bash
# API Gateway
export BASE_URL="https://api.ringer.tel"
export API_USER="test@ringer.tel"
export API_PASSWORD="testpass"

# Voice/SIP
export KAMAILIO_IP="10.0.1.10"
export KAMAILIO_PORT="5060"

# SMS/SMPP
export SMPP_HOST="jasmin.ringer.tel"
export SMPP_PORT="2775"
export SMPP_USER="test_user"
export SMPP_PASSWORD="test_pass"
```

### Test Data

Test data files are located in `/test-data`:
- `test_audio.pcap` - Sample RTP audio for voice tests
- Test phone numbers and credentials are defined in each test script

## Test Results

After running tests, results are available in:
- Individual test results: `{test-category}/results/`
- Consolidated results: `./results/test-run-{timestamp}/`
- HTML report: `./results/test-run-{timestamp}/test_report.html`

## Interpreting Results

### Success Criteria
- **Voice**: >99% registration success, <2s call setup, >98% call completion
- **SMS**: >98% delivery rate, <2s processing time, >1000 msg/sec throughput
- **API**: <100ms latency, >99.9% availability, proper auth/authz
- **Integration**: All end-to-end scenarios pass, <30s failover time

### Common Issues
1. **Network Connectivity**: Ensure all services are reachable
2. **Authentication**: Verify credentials are correctly configured
3. **Rate Limits**: Some tests may hit rate limits intentionally
4. **Resource Limits**: Ensure sufficient resources for load tests

## Extending Tests

### Adding New Test Scenarios

1. **Voice Tests**: Add new SIPp scenarios in `/voice/sipp-scenarios/`
2. **SMS Tests**: Extend Python test clients in `/sms/scripts/`
3. **API Tests**: Add test methods to Kong test suite
4. **Integration**: Add scenarios to integration test runner

### Custom Test Scripts

Follow the pattern:
1. Use consistent logging (log_info, log_error)
2. Generate both human-readable and machine-parseable output
3. Exit with appropriate codes (0 = success, non-zero = failure)
4. Save results to designated results directories

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Phase 2 Tests
  run: |
    cd tests/phase2
    ./run-all-tests.sh
  env:
    API_URL: ${{ secrets.API_URL }}
    API_PASSWORD: ${{ secrets.API_PASSWORD }}
```

## Support

For issues or questions:
1. Check test logs in results directories
2. Verify service connectivity and health
3. Ensure all prerequisites are installed
4. Review service-specific documentation