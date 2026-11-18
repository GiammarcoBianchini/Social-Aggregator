import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDb } from '../src/db.js';
import { dbPath } from '../src/paths.js';
import { createServer } from '../src/mcp.js';

openDb(dbPath()).raw.close(); // creates the schema on first launch
const db = openDb(dbPath(), { readonly: true });
const server = createServer(db, () => openDb(dbPath()));
await server.connect(new StdioServerTransport());
