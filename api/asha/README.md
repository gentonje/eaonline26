# Asha engine boundary

Asha is being separated from East Africa Online so the same conversation intelligence can later serve other businesses and applications.

## Current boundary

- `core.js` owns natural-language interpretation: conversation context, intent parsing, model-provider calls, and filter validation. It receives the live marketplace department names as context rather than depending on a complete hardcoded product dictionary.
- `discovery.js` maps shopper language to the live taxonomy, expands department trees, and builds alternative suggestions from actual published listing types.
- `../ai/assistant.js` is the East Africa Online adapter: Supabase authentication, live taxonomy loading, department-level product/service search, related-listing discovery, and marketplace response formatting.
- The frontend calls the marketplace adapter today. No external SaaS API or MCP server is exposed yet.

## Engine contract

The engine accepts a shopper message and returns a validated intent object:

- `interpret(message, context)` → intent, query, category, filters, and optional clarification suggestions. Context includes recent chat turns and live department names.
- `discovery.js` resolves broad concepts against taxonomy labels and aliases, searches category descendants, and proposes alternatives only from published listing types.
- `parseIntent(message)` → deterministic local interpretation, useful when no model provider is configured.
- `validateIntent(modelOutput, fallback)` → allowlisted structured output; model output is never SQL.
- `detectClarification(message)` → optional compact clarification request.

The language engine does not connect to a database, hold tenant credentials, or execute business actions. The marketplace adapter supplies a bounded taxonomy context and performs all database discovery.

## Provider configuration

The engine currently supports Groq first and Gemini fallback through server-side environment variables. Provider keys must never be sent to a browser or mobile client.

## Next boundary

Stage 3 will introduce a business-data adapter contract. The marketplace adapter will implement it first; later customers can connect an approved API, database service, or customer-controlled MCP server without changing the conversation engine.

## Security rule

A business adapter must enforce tenant identity, scoped credentials, field/tool permissions, and read-only defaults independently of model output. The model may request an approved operation; it cannot choose credentials, SQL, or unrestricted database access.
