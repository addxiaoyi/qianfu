import { existsSync, readFileSync } from 'node:fs';
import { swaggerSpec } from '../server/config/swagger';
import {
  OPENAPI_OUTPUT_PATH,
  buildOpenApiSpec,
  stableJson,
} from './lib/openapi-sync-utils';

const expected = stableJson(buildOpenApiSpec(swaggerSpec as unknown as Record<string, unknown>));

if (!existsSync(OPENAPI_OUTPUT_PATH)) {
  console.error(`❌ Missing OpenAPI artifact: ${OPENAPI_OUTPUT_PATH}`);
  console.error('Run: npm run generate:openapi');
  process.exit(1);
}

const actual = readFileSync(OPENAPI_OUTPUT_PATH, 'utf-8');
if (actual !== expected) {
  console.error('❌ OpenAPI artifact is out of sync with current code annotations.');
  console.error(`Expected file: ${OPENAPI_OUTPUT_PATH}`);
  console.error('Run: npm run generate:openapi');
  process.exit(1);
}

console.log('✅ OpenAPI artifact is in sync');
