// Quick test to verify DTO transform behavior
const { Transform } = require('class-transformer');

function testTransform() {
  const transform = ({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return Boolean(value);
  };

  console.log('Testing transform function:');
  console.log('undefined:', transform({ value: undefined }));
  console.log('null:', transform({ value: null }));
  console.log('"true":', transform({ value: 'true' }));
  console.log('"false":', transform({ value: 'false' }));
  console.log('"TRUE":', transform({ value: 'TRUE' }));
  console.log('"FALSE":', transform({ value: 'FALSE' }));
  console.log('true:', transform({ value: true }));
  console.log('false:', transform({ value: false }));
  console.log('1:', transform({ value: 1 }));
  console.log('0:', transform({ value: 0 }));
  console.log('"":', transform({ value: '' }));
}

function testDefaulting() {
  const query = { includeCrowdLevel: false };
  const { includeCrowdLevel = true } = query;
  console.log('\nTesting destructuring with default:');
  console.log('query.includeCrowdLevel:', query.includeCrowdLevel);
  console.log('destructured value:', includeCrowdLevel);
  
  const query2 = {};
  const { includeCrowdLevel: includeCrowdLevel2 = true } = query2;
  console.log('\nTesting with undefined:');
  console.log('query2.includeCrowdLevel:', query2.includeCrowdLevel);
  console.log('destructured value:', includeCrowdLevel2);
}

testTransform();
testDefaulting();
