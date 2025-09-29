#!/usr/bin/env node

import { run } from '@oclif/core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await run(process.argv.slice(2), join(__dirname, '..'));
