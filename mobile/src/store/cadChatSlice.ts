import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CadChatState, ChatMessage } from '../types/cad';

const initialState: CadChatState = {
  taskId: null,
  messages: [],
  phase: 'idle',
  currentSpec: null,
  isWaitingForReply: false,
  error: null,
};

export const cadChatSlice = createSlice({
  name: 'cadChatState',
  initialState,
  reducers: {
    startChat: (state, action: PayloadAction<{ taskId: string }>) => {
      state.taskId = action.payload.taskId;
      state.phase = 'freeform';
      state.currentSpec = null;
      state.error = null;
    },
    addUserMessage: (state, action: PayloadAction<{ message: ChatMessage }>) => {
      state.messages.push(action.payload.message);
      state.isWaitingForReply = true;
      state.error = null;
    },
    addAssistantMessage: (state, action: PayloadAction<{ message: ChatMessage }>) => {
      state.messages.push(action.payload.message);
      state.isWaitingForReply = false;
      if (action.payload.message.phase) {
        state.phase = action.payload.message.phase;
      }
      if (action.payload.message.spec) {
        state.currentSpec = action.payload.message.spec;
      }
    },
    setPhase: (state, action: PayloadAction<{ phase: CadChatState['phase'] }>) => {
      state.phase = action.payload.phase;
    },
    setSpec: (state, action: PayloadAction<{ spec: Record<string, any> }>) => {
      state.currentSpec = action.payload.spec;
    },
    setWaitingForReply: (state, action: PayloadAction<{ isWaiting: boolean }>) => {
      state.isWaitingForReply = action.payload.isWaiting;
    },
    setChatError: (state, action: PayloadAction<{ error: string | null }>) => {
      state.error = action.payload.error;
      state.isWaitingForReply = false;
    },
    hydrateChatHistory: (state, action: PayloadAction<{ taskId: string; messages: ChatMessage[] }>) => {
      state.taskId = action.payload.taskId;
      state.messages = action.payload.messages;
      state.isWaitingForReply = false;
      state.error = null;

      let restoredPhase: CadChatState['phase'] = 'confirmed';
      let restoredSpec: Record<string, any> | null = null;
      for (let i = action.payload.messages.length - 1; i >= 0; i--) {
        const msg = action.payload.messages[i];
        if (msg.role === 'assistant' && msg.phase) {
          restoredPhase = msg.phase;
          if (msg.spec) restoredSpec = msg.spec;
          break;
        }
      }
      state.phase = restoredPhase;
      state.currentSpec = restoredSpec;
    },
    resetConversation: () => initialState,
  },
});

export const {
  startChat,
  addUserMessage,
  addAssistantMessage,
  setPhase,
  setSpec,
  setWaitingForReply,
  setChatError,
  hydrateChatHistory,
  resetConversation,
} = cadChatSlice.actions;

export default cadChatSlice.reducer;
