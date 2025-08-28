// test-api.js - Node.js test script for Express backend
const BASE_URL = 'https://api.dahligarciamarquez.com';

const tests = [
  {
    name: 'Root route (/)',
    path: '/',
    expectedStatus: 200,
    expectedKeys: ['ok', 'service']
  },
  {
    name: 'Health check (/healthz)',
    path: '/healthz',
    expectedStatus: 200,
    expectedKeys: ['ok']
  },
  {
    name: 'Hello endpoint (/api/hello)',
    path: '/api/hello',
    expectedStatus: 200,
    expectedKeys: ['message']
  },
  {
    name: '404 route (/doesnotexist)',
    path: '/doesnotexist',
    expectedStatus: 404,
    expectedKeys: ['error']
  }
];

async function testEndpoint(test) {
  console.log(`\n${test.name}`);
  console.log('---');
  
  try {
    const response = await fetch(`${BASE_URL}${test.path}`);
    const data = await response.json();
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    
    // Verify expected status
    if (response.status === test.expectedStatus) {
      console.log('✅ Status code correct');
    } else {
      console.log(`❌ Expected ${test.expectedStatus}, got ${response.status}`);
    }
    
    // Verify expected keys exist
    const hasAllKeys = test.expectedKeys.every(key => key in data);
    if (hasAllKeys) {
      console.log('✅ Response structure correct');
    } else {
      console.log(`❌ Missing expected keys: ${test.expectedKeys.join(', ')}`);
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Testing Express API endpoints');
  console.log('==================================');
  
  for (const test of tests) {
    await testEndpoint(test);
  }
  
  console.log('\n==================================');
  console.log('✅ API testing complete!');
}

// Run the tests
runTests().catch(console.error);
