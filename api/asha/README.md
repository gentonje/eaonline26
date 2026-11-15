# Asha engine boundary

Asha is being separated from East Africa Online so the same conversation intelligence can later serve other businesses and applications.

## Current boundary

- `core.js` owns natural-language interpretation: normalization, typo handling, clarification, intent parsing, model-provider calls, and filter validation.
- `../ai/assistant.js` is the East Africa Online adapter: Supabase authentication, marketplace taxonomy lookup, product search, and marketplace response formatting.
- The frontend calls the marketplace adapter today. No external SaaS API or MCP server is exposed yet.

## Engine contract

The engine accepts a shopper message and returns a validated intent object:

- `interpret(message)` → intent, query, category, filters, and optional clarification suggestions.
- `parseIntent(message)` → deterministic local interpretation, useful when no model provider is configured.
- `validateIntent(modelOutput, fallback)` → allowlisted structured output; model output is never SQL.
- `detectClarification(message)` → optional compact clarification request.

The engine does not connect to a database, hold tenant credentials, or execute business actions.

## Provider configuration

The engine currently supports Groq first and Gemini fallback through server-side environment variables. Provider keys must never be sent to a browser or mobile client.

## Next boundary

Stage 3 will introduce a business-data adapter contract. The marketplace adapter will implement it first; later customers can connect an approved API, database service, or customer-controlled MCP server without changing the conversation engine.

## Security rule

A business adapter must enforce tenant identity, scoped credentials, field/tool permissions, and read-only defaults independently of model output. The model may request an approved operation; it cannot choose credentials, SQL, or unrestricted database access.
