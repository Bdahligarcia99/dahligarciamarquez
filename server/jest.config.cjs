module.exports = {
  // Use Node.js test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(js|ts)',
    '**/?(*.)+(spec|test).(js|ts)'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    'routes/**/*.{js,ts}',
    'middleware/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!**/node_modules/**'
  ],
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
};
