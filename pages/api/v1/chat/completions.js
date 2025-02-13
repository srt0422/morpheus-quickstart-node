import OpenAI from "openai";

const MODEL = process.env.MODEL_NAME || "LMR-Hermes-2-Theta-Llama-3-8B";
console.log('API Config:', {
  baseURL: process.env.OPENAI_API_URL,
  model: MODEL
});

const openai = new OpenAI({
  apiKey: "sk-",
  baseURL: process.env.OPENAI_API_URL,
  defaultPath: process.env.CHAT_COMPLETIONS_PATH || '/v1/chat/completions'
});

export const config = {
  api: {
    responseLimit: false,
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages must be an array' });
  }

  try {
    console.log('Making request to OpenAI with:', {
      model: MODEL,
      messagesCount: messages.length
    });

    // Enable streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial response to confirm connection
    res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        // Send both the delta and full response
        res.write(`data: ${JSON.stringify({ 
          content,
          fullResponse,
          done: false,
          timestamp: Date.now()
        })}\n\n`);
      }
    }

    // Send final response with complete text
    res.write(`data: ${JSON.stringify({ 
      content: '',
      fullResponse,
      done: true,
      timestamp: Date.now()
    })}\n\n`);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    // Send error in SSE format
    res.write(`data: ${JSON.stringify({ 
      error: error.message,
      code: error.status || 500,
      type: error.type || 'internal_error',
      timestamp: Date.now()
    })}\n\n`);
  } finally {
    res.end();
  }
} 