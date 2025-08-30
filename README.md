# Negotiator API

A minimal Node.js Express REST API exposing OpenAI Chat Completions with function calling, plus Swagger UI for testing.

## Setup

1. Copy env example and set your key:

`
copy env.example .env
`

Then edit .env and set OPENAI_API_KEY.

2. Install dependencies:

`
npm install
`

3. Start the server:

`
npm run start
`

Open Swagger UI at http://localhost:3000/docs

## Endpoint

- POST /v1/chat
  - Body:
    `json
    {
       model: gpt-4o-mini,
      messages: [
        { role: system, content: You are a helpful assistant. },
        { role: user, content: What is the weather in Paris? }
      ]
    }
    `
  - Returns full transcript and the final OpenAI response. If the model requests tool calls, the server executes them and feeds results back until completion.

## Notes

- Example tools include get_current_weather and get_current_time (mocked).
- Replace the tool executors in src/lib/tools.js with real APIs as needed.