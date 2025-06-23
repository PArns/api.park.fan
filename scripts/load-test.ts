import autocannon from 'autocannon';

const url = process.env.API_URL || 'http://localhost:3000';
const threshold = parseInt(process.env.LOAD_TEST_THRESHOLD_MS || '1000', 10);

const endpoints = [
  '/',
  '/status',
  '/parks',
  '/parks/europe',
  '/parks/europe/germany',
  '/parks/europe/germany/phantasialand',
];

async function run(endpoint: string) {
  console.log(`Running load test for ${url}${endpoint}`);
  const result = await autocannon({
    url: url + endpoint,
    connections: 50,
    duration: 20,
  });

  if (result.latency.average > threshold) {
    console.error(
      `\u274c ${endpoint} average latency ${result.latency.average}ms exceeds threshold ${threshold}ms`,
    );
  } else {
    console.log(
      `\u2705 ${endpoint} average latency ${result.latency.average}ms`,
    );
  }

  autocannon.printResult(result);
}

async function main() {
  for (const ep of endpoints) {
    await run(ep);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
