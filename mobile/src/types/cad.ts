export interface CadGenerationSettings {
  max_iterations: number;
  timeout_seconds: number;
  target_units: string;
  process: string;
  approximate_size: {
    width: number | null;
    depth: number | null;
    height: number | null;
  } | null;
  material_hint: string;
  features: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: number;
  phase?: 'freeform' | 'guided' | 'confirmation' | 'confirmed';
  spec?: Record<string, any>;
}

export interface CadChatState {
  taskId: string | null;
  messages: ChatMessage[];
  phase: 'idle' | 'freeform' | 'guided' | 'confirmation' | 'confirmed' | 'generating';
  currentSpec: Record<string, any> | null;
  isWaitingForReply: boolean;
  error: string | null;
}

export interface CadState {
  cadLoading: boolean;
  cadLoadedPercentage: number;
  cadPending: boolean;
  cadGenerationSettings: CadGenerationSettings;
  cadError: string | null;
  cadStatusMessage: string | null;
  cadOperationType: string | null;
  completedModel: {
    taskId: string;
    glbUrl: string;
    fileName: string;
  } | null;
}

export interface CadChatResponse {
  task_id: string;
  reply: string;
  phase: 'freeform' | 'guided' | 'confirmation' | 'confirmed';
  spec: Record<string, any> | null;
}
