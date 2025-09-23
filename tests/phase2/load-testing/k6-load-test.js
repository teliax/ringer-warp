/*
 * K6 Load Test Script for WARP Platform
 * Tests API Gateway, Voice, and SMS endpoints under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

// Custom metrics
const apiErrors = new Counter('api_errors');
const apiSuccess = new Counter('api_success');
const apiLatency = new Trend('api_latency');
const smsErrors = new Counter('sms_errors');
const smsSuccess = new Counter('sms_success');
const authErrors = new Counter('auth_errors');
const authSuccess = new Counter('auth_success');

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: API Authentication
    auth_load: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 20,
      exec: 'authTest',
    },
    
    // Scenario 2: API Traffic
    api_load: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 100 },  // Stay at peak
        { duration: '2m', target: 20 },   // Ramp down
      ],
      exec: 'apiTest',
    },
    
    // Scenario 3: SMS Traffic
    sms_load: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 30,
      exec: 'smsTest',
    },
    
    // Scenario 4: Spike Test
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      stages: [
        { duration: '30s', target: 5 },    // Warm up
        { duration: '10s', target: 200 },  // Spike!
        { duration: '30s', target: 5 },    // Recovery
      ],
      exec: 'spikeTest',
      startTime: '6m',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],                  // Error rate under 5%
    api_errors: ['count<100'],                        // Less than 100 API errors
    auth_errors: ['count<50'],                        // Less than 50 auth errors
  },
};

// Load test data
const testUsers = new SharedArray('users', function () {
  return [
    { username: 'test1@ringer.tel', password: 'TestPass123!' },
    { username: 'test2@ringer.tel', password: 'TestPass123!' },
    { username: 'test3@ringer.tel', password: 'TestPass123!' },
  ];
});

const phoneNumbers = new SharedArray('phones', function () {
  const numbers = [];
  for (let i = 0; i < 100; i++) {
    numbers.push({
      from: `+1212555${1000 + i}`,
      to: `+1310555${2000 + i}`,
    });
  }
  return numbers;
});

// Base configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.ringer.tel';
const SMS_API_URL = __ENV.SMS_API_URL || 'http://jasmin.ringer.tel:8080';

// Helper function to get auth token
function getAuthToken(user) {
  const loginRes = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({
      username: user.username,
      password: user.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  if (loginRes.status === 200) {
    authSuccess.add(1);
    return JSON.parse(loginRes.body).token;
  } else {
    authErrors.add(1);
    return null;
  }
}

// Scenario 1: Authentication Test
export function authTest() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  const startTime = new Date();
  const res = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({
      username: user.username,
      password: user.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'AuthLogin' },
    }
  );
  const latency = new Date() - startTime;
  
  const success = check(res, {
    'login successful': (r) => r.status === 200,
    'has token': (r) => r.json('token') !== undefined,
  });
  
  if (success) {
    authSuccess.add(1);
  } else {
    authErrors.add(1);
  }
  
  apiLatency.add(latency);
  sleep(1);
}

// Scenario 2: API Test
export function apiTest() {
  const user = testUsers[exec.scenario.iterationInTest % testUsers.length];
  const token = getAuthToken(user);
  
  if (!token) {
    apiErrors.add(1);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Random API operation
  const operations = [
    () => {
      // Get customers
      const res = http.get(`${BASE_URL}/v1/customers`, {
        headers,
        tags: { name: 'GetCustomers' },
      });
      return res;
    },
    () => {
      // Get trunks
      const res = http.get(`${BASE_URL}/v1/trunks`, {
        headers,
        tags: { name: 'GetTrunks' },
      });
      return res;
    },
    () => {
      // Create routing rule
      const res = http.post(
        `${BASE_URL}/v1/routing/rules`,
        JSON.stringify({
          pattern: '+1212*',
          priority: 100,
          route_type: 'trunk',
          route_id: 'test-trunk-1',
        }),
        {
          headers,
          tags: { name: 'CreateRoute' },
        }
      );
      return res;
    },
    () => {
      // Get CDRs
      const res = http.get(`${BASE_URL}/v1/cdrs?limit=10`, {
        headers,
        tags: { name: 'GetCDRs' },
      });
      return res;
    },
  ];
  
  const startTime = new Date();
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const res = operation();
  const latency = new Date() - startTime;
  
  const success = check(res, {
    'status is 200 or 201': (r) => [200, 201].includes(r.status),
    'no errors': (r) => !r.json('error'),
  });
  
  if (success) {
    apiSuccess.add(1);
  } else {
    apiErrors.add(1);
  }
  
  apiLatency.add(latency);
  
  // Check rate limit headers
  check(res, {
    'has rate limit headers': (r) => 
      r.headers['X-RateLimit-Limit'] !== undefined,
  });
  
  sleep(Math.random() * 2);
}

// Scenario 3: SMS Test
export function smsTest() {
  const phone = phoneNumbers[Math.floor(Math.random() * phoneNumbers.length)];
  
  const params = new URLSearchParams({
    username: 'test_user',
    password: 'test_pass',
    to: phone.to,
    from: phone.from,
    content: `Load test message ${exec.scenario.iterationInTest}`,
  });
  
  const res = http.post(
    `${SMS_API_URL}/send?${params}`,
    null,
    {
      tags: { name: 'SendSMS' },
    }
  );
  
  const success = check(res, {
    'SMS sent': (r) => r.status === 200,
    'has message ID': (r) => r.body.includes('Success'),
  });
  
  if (success) {
    smsSuccess.add(1);
  } else {
    smsErrors.add(1);
  }
  
  sleep(0.5);
}

// Scenario 4: Spike Test (mixed traffic)
export function spikeTest() {
  const rand = Math.random();
  
  if (rand < 0.3) {
    authTest();
  } else if (rand < 0.7) {
    apiTest();
  } else {
    smsTest();
  }
}

// Lifecycle hooks
export function setup() {
  console.log('Starting WARP Platform Load Test');
  console.log(`API URL: ${BASE_URL}`);
  console.log(`SMS URL: ${SMS_API_URL}`);
  
  // Verify connectivity
  const healthCheck = http.get(`${BASE_URL}/v1/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API health check failed');
  }
  
  return {
    startTime: new Date().toISOString(),
  };
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Started: ${data.startTime}`);
  console.log(`Ended: ${new Date().toISOString()}`);
}

// Custom summary
export function handleSummary(data) {
  const customData = {
    'Total API Requests': data.metrics.http_reqs.values.count,
    'API Success Rate': 
      (apiSuccess.values.count / (apiSuccess.values.count + apiErrors.values.count) * 100).toFixed(2) + '%',
    'Auth Success Rate':
      (authSuccess.values.count / (authSuccess.values.count + authErrors.values.count) * 100).toFixed(2) + '%',
    'SMS Success Rate':
      (smsSuccess.values.count / (smsSuccess.values.count + smsErrors.values.count) * 100).toFixed(2) + '%',
    'Average Latency': apiLatency.values.avg.toFixed(2) + 'ms',
    'P95 Latency': data.metrics.http_req_duration.values['p(95)'].toFixed(2) + 'ms',
    'P99 Latency': data.metrics.http_req_duration.values['p(99)'].toFixed(2) + 'ms',
  };
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    '/home/daldworth/repos/ringer-warp/tests/phase2/load-testing/results/summary.json': JSON.stringify(customData, null, 2),
  };
}

// Helper function for text summary
function textSummary(data, options) {
  let summary = '\n=== WARP PLATFORM LOAD TEST SUMMARY ===\n\n';
  
  summary += `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `Failed Requests: ${data.metrics.http_req_failed.values.passes}\n`;
  summary += `Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  summary += '=== CUSTOM METRICS ===\n';
  summary += `API Success: ${apiSuccess.values.count}\n`;
  summary += `API Errors: ${apiErrors.values.count}\n`;
  summary += `Auth Success: ${authSuccess.values.count}\n`;
  summary += `Auth Errors: ${authErrors.values.count}\n`;
  summary += `SMS Success: ${smsSuccess.values.count}\n`;
  summary += `SMS Errors: ${smsErrors.values.count}\n`;
  
  return summary;
}