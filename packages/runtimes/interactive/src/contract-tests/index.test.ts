// packages/runtimes/interactive/src/contract-tests/index.test.ts
// T-306 AC #21–#23 — contractTestSuite self-validation. Running the suite
// against a stub factory exercises every assertion the suite makes.

import { makeStubFactory } from './fixtures.js';
import { contractTestSuite } from './index.js';

contractTestSuite(makeStubFactory(), {
  family: 'shader',
  suiteName: 'contract-test suite — stub-factory self-test',
});
