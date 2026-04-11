import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CadChatState, ChatMessage } from "../app/utility/interfaces";

const initialState: CadChatState = {
  conversationId: null,
  messages: [],
  phase: 'idle',
  currentSpec: null,
  isWaitingForReply: false,
  error: null,
};

export const cadChatSlice = createSlice({
  name: "cadChatState",
  initialState,
  reducers: {
    startConversation: (state, action: PayloadAction<{ conversationId: string }>) => {
      state.conversationId = action.payload.conversationId;
      state.messages = [];
      state.phase = 'freeform';
      state.currentSpec = null;
      state.isWaitingForReply = false;
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
    resetConversation: () => initialState,
  },
});

export const {
  startConversation,
  addUserMessage,
  addAssistantMessage,
  setPhase,
  setSpec,
  setWaitingForReply,
  setChatError,
  resetConversation,
} = cadChatSlice.actions;

export default cadChatSlice.reducer;
