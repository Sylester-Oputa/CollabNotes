const jwt = require('jsonwebtoken');
require('dotenv').config();

// Create a test token for the HEAD_OF_DEPARTMENT user
const testToken = jwt.sign(
  { userId: 'cmflny0rb0005ttzcncus1f39' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Test JWT Token:');
console.log(testToken);
console.log('\nTest this with:');
console.log(`curl -H "Authorization: Bearer ${testToken}" http://localhost:5001/api/departments/cmflk9mqp0001tt5wws10x0wg`);