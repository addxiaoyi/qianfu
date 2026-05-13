import { writeFileSync } from 'node:fs';
import { swaggerSpec } from '../server/config/swagger';
import {
  OPENAPI_OUTPUT_PATH,
  buildOpenApiSpec,
  stableJson,
} from './lib/openapi-sync-utils';

const spec = buildOpenApiSpec(swaggerSpec as unknown as Record<string, unknown>);
writeFileSync(OPENAPI_OUTPUT_PATH, stableJson(spec), 'utf-8');
console.log(`[generate-openapi] written to ${OPENAPI_OUTPUT_PATH}`);
