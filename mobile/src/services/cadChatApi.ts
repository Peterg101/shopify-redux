import { getToken } from './auth';
import { GENERATION_URL, API_URL } from './config';
import type { CadGenerationSettings, CadChatResponse } from '../types/cad';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function startChatSession(userId: string): Promise<{ task_id: string }> {
  const response = await fetch(`${GENERATION_URL}/cad/chat/start`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error(`Failed to start chat: ${response.statusText}`);
  return response.json();
}

export async function sendChatMessage(
  taskId: string,
  userId: string,
  content: string,
  images: string[],
  designIntent: CadGenerationSettings,
  onToken: (text: string) => void,
  onDone: (response: CadChatResponse) => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    const response = await fetch(`${GENERATION_URL}/cad/chat`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        task_id: taskId,
        user_id: userId,
        message: { role: 'user', content, images },
        design_intent: designIntent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'token') {
            onToken(event.text);
          } else if (event.type === 'done') {
            onDone({
              task_id: event.task_id,
              reply: event.reply,
              phase: event.phase,
              spec: event.spec,
            });
          } else if (event.type === 'error') {
            onError(event.message);
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } catch (error: any) {
    onError(error.message || 'Connection failed');
  }
}

export async function confirmSpec(
  taskId: string,
  userId: string,
  portId: string,
  spec: Record<string, any>,
  settings: CadGenerationSettings,
): Promise<{ message: string; task_id: string }> {
  const response = await fetch(`${GENERATION_URL}/cad/chat/confirm`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      task_id: taskId,
      port_id: portId,
      user_id: userId,
      spec,
      settings,
    }),
  });
  if (!response.ok) throw new Error(`Confirm failed: ${response.statusText}`);
  return response.json();
}

export async function fetchConversation(taskId: string): Promise<{ messages: any[] }> {
  try {
    const token = await getToken();
    const response = await fetch(`${API_URL}/tasks/${taskId}/conversation`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`Failed to fetch conversation: ${response.statusText}`);
    return response.json();
  } catch {
    return { messages: [] };
  }
}
