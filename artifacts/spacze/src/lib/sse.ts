export async function parseSSE<T>(
  response: Response,
  onChunk: (data: T) => void,
  onDone: () => void,
  onError: (error: Error) => void
) {
  try {
    if (!response.body) {
      throw new Error('No response body');
    }
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue; // Sometimes APIs send [DONE]
            
            const data = JSON.parse(dataStr);
            if (data.done) {
              onDone();
            } else {
              onChunk(data);
            }
          } catch (e) {
            console.error('Failed to parse SSE JSON:', line, e);
          }
        }
      }
    }
    
    // In case there's no explicit done event but stream ends
    onDone();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
