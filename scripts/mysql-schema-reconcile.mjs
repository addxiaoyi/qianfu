#!/usr/bin/env node
import { runCli } from './schema-reconcile.mjs';

runCli({ forcedProvider: 'mysql' });
