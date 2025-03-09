import { FC, useState, useEffect, useRef } from 'react'
import { Button, Text } from '@vercel/examples-ui'

function formatKey(key: string): string {
  // Format key for display, showing only part of it for security
  if (key.startsWith('sk-')) {
    return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`
  }
  // For JWT tokens, just show the first few characters
  return `${key.substring(0, 12)}...`
}

function fetchChatDemo(key: string) {
  if (!key) {
    return `// No API key selected - requests will fail
fetch('/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'LMR-Hermes-3-Llama-3.1-8B',
    messages: [{ role: 'user', content: 'Say hello' }],
    stream: true
  })
})`
  }
  
  return `fetch('/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${key}'
  },
  body: JSON.stringify({
    model: 'LMR-Hermes-3-Llama-3.1-8B',
    messages: [{ role: 'user', content: 'Say hello' }],
    stream: true
  })
})`
}

const ApiRequest: FC<{ activeKeys: string[] }> = ({ activeKeys }) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [streamingOutput, setStreamingOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [requestState, setRequestState] = useState<any>({
    endpoint: '/api/v1/chat/completions',
    status: null,
    model: 'LMR-Hermes-3-Llama-3.1-8B',
    prompt: 'Say hello',
    streaming: true
  })
  
  const abortControllerRef = useRef<AbortController | null>(null)

  // Select the first active key by default when the list changes
  useEffect(() => {
    if (activeKeys.length > 0 && !activeKeys.includes(selectedKey)) {
      setSelectedKey(activeKeys[0])
    } else if (activeKeys.length === 0) {
      setSelectedKey('')
    }
  }, [activeKeys, selectedKey])

  const handleChatRequest = async () => {
    setLoading(true)
    setStreamingOutput('')
    setError(null)
    
    // Create an AbortController to cancel the request if needed
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    
    try {
      const start = Date.now()
      
      // Prepare the chat completion request
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(selectedKey ? { 'Authorization': `Bearer ${selectedKey}` } : {})
        },
        body: JSON.stringify({
          model: requestState.model,
          messages: [{ role: 'user', content: requestState.prompt }],
          stream: requestState.streaming
        }),
        signal: abortControllerRef.current.signal
      })
      
      setRequestState((prev: any) => ({
        ...prev,
        status: response.status,
        latency: `~${Math.round(Date.now() - start)}ms`
      }))
      
      if (!response.ok) {
        const errorData = await response.json()
        setError(`Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
        setLoading(false)
        return
      }
      
      // Handle streaming response
      if (requestState.streaming) {
        const reader = response.body?.getReader()
        if (!reader) {
          setError('Error: Response body cannot be read')
          setLoading(false)
          return
        }
        
        // Process the stream
        const decoder = new TextDecoder()
        let streamBuffer = ''
        let resultText = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          // Decode and process the chunk
          const chunk = decoder.decode(value, { stream: true })
          console.log("Received chunk:", chunk)
          
          // Direct text append - for when the server just sends raw text
          if (!chunk.includes('data:')) {
            resultText += chunk
            setStreamingOutput(resultText)
            continue // Skip JSON parsing for plain text chunks
          }
          
          // Handle SSE format (data: prefix)
          streamBuffer += chunk
          
          // Split by "data:" lines and process each SSE event
          const lines = streamBuffer.split('\n')
          streamBuffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.substring(5).trim()
              
              // Handle the SSE data
              if (data === '[DONE]') {
                // Stream is complete
                continue
              }
              
              try {
                // Try parsing as JSON but fallback to handling as plain text
                const json = JSON.parse(data)
                // Handle both OpenAI format and BaseImage format
                if (json.choices && json.choices[0]?.delta?.content) {
                  // OpenAI format
                  resultText += json.choices[0].delta.content
                  setStreamingOutput(resultText)
                } else if (json.content || json.text || json.response) {
                  // BaseImage might return in a different format
                  const content = json.content || json.text || json.response
                  resultText += content
                  setStreamingOutput(resultText)
                } else if (typeof json === 'string') {
                  // Plain text response
                  resultText += json
                  setStreamingOutput(resultText)
                } else {
                  // Unknown format, just append the whole JSON
                  resultText += JSON.stringify(json)
                  setStreamingOutput(resultText)
                }
              } catch (e) {
                // Not valid JSON, treat as plain text
                console.log("Failed to parse as JSON, treating as text:", data)
                // If data is a string and doesn't look like broken JSON, use it directly
                if (data && typeof data === 'string') {
                  resultText += data
                  setStreamingOutput(resultText)
                }
              }
            } else if (line.trim()) {
              // Non-SSE line with content, treat as plain text
              resultText += line
              setStreamingOutput(resultText)
            }
          }
        }
      } else {
        // Handle non-streaming response
        const data = await response.json()
        
        // Handle both OpenAI format and BaseImage format
        if (data.choices && data.choices[0]?.message?.content) {
          // OpenAI format
          setStreamingOutput(data.choices[0].message.content)
        } else if (data.content || data.text || data.response) {
          // BaseImage might return in a different format
          setStreamingOutput(data.content || data.text || data.response)
        } else {
          // Unknown format, just show the raw JSON
          setStreamingOutput(JSON.stringify(data, null, 2))
        }
      }
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setError(`Error: ${error.message}`)
        console.error('Request error:', error)
      }
    } finally {
      setLoading(false)
    }
  }
  
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setLoading(false)
    }
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setRequestState((prev: any) => ({ ...prev, [name]: finalValue }))
  }

  return (
    <div className="grid">
      <div className="mb-6">
        <Text className="mb-2 font-bold">Test Chat Completions Endpoint</Text>
        
        <div className="bg-gray-50 p-4 rounded-md mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <div className="rounded-md border border-accents-2 px-4 py-2 w-full bg-gray-50">
                LMR-Hermes-3-Llama-3.1-8B
              </div>
            </div>
            
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="streaming"
                  checked={requestState.streaming}
                  onChange={handleInputChange}
                  className="mr-2 h-4 w-4"
                />
                <span className="text-sm font-medium text-gray-700">Enable streaming</span>
              </label>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt
            </label>
            <textarea
              name="prompt"
              value={requestState.prompt}
              onChange={handleInputChange}
              rows={3}
              className="rounded-md border border-accents-2 px-4 py-2 w-full"
            ></textarea>
          </div>
        </div>
      </div>
      
      <pre className="border-accents-2 border rounded-md bg-white overflow-x-auto p-6 mb-2">
        {fetchChatDemo(selectedKey)}
      </pre>
      
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Text className="font-bold">Response</Text>
          {requestState.status && (
            <Text className="text-sm">
              Status: {requestState.status} | Latency: {requestState.latency}
            </Text>
          )}
        </div>
        <div 
          className={`bg-gray-50 rounded-md p-6 min-h-[200px] whitespace-pre-wrap ${loading ? 'animate-pulse' : ''}`}
        >
          {error ? (
            <div className="text-red-500">{error}</div>
          ) : streamingOutput ? (
            <div>{streamingOutput}</div>
          ) : (
            <div className="text-gray-400">Response will appear here</div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto">
          {activeKeys.length > 0 ? (
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select API Key ({activeKeys.length} active):
              </label>
              <select 
                className="rounded-md border border-accents-2 px-4 py-2"
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
              >
                <option value="">None (will fail without key)</option>
                {activeKeys.map((key) => (
                  <option key={key} value={key}>
                    {formatKey(key)} {key.startsWith('sk-') ? '(OpenAI-compatible)' : '(JWT)'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Text className="text-amber-600">
              No active API keys. Activate a key above to test the API.
            </Text>
          )}
        </div>
        
        <div className="flex gap-2">
          {loading && (
            <Button
              variant="secondary"
              type="button"
              onClick={handleStop}
            >
              Stop
            </Button>
          )}
          <Button
            variant="black"
            type="button"
            className="min-w-[120px]"
            onClick={handleChatRequest}
            loading={loading}
          >
            {loading ? 'Streaming...' : 'Make request'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ApiRequest
