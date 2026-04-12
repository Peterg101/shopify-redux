import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Box, Typography, Chip, CircularProgress, LinearProgress } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../../app/store';
import { generateUuid } from '../../../app/utility/collectionUtils';
import { ChatMessage } from '../../../app/utility/interfaces';
import {
  startChat,
  addUserMessage,
  addAssistantMessage,
  setPhase,
  setChatError,
} from '../../../services/cadChatSlice';
import { setCadPending, setCadLoading, setCadOperationType } from '../../../services/cadSlice';
import { authApi } from '../../../services/authApi';
import { startChatSession, sendChatMessageStreaming, confirmSpec } from '../../../services/cadChatApi';
import { connectProgressStream } from '../../../services/progressStream';
import { useFile } from '../../../services/fileProvider';
import logger from '../../../app/utility/logger';
import { CadDesignIntent } from '../CadGenerationSettings';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import {
  borderSubtle,
  borderHover,
  bgHighlight,
  glowSubtle,
} from '../../../theme';

const SketchPanel = lazy(() => import('./SketchPanel'));

const PHASE_LABELS: Record<string, string> = {
  freeform: 'Understanding your design',
  guided: 'Clarifying details',
  confirmation: 'Ready to confirm',
  confirmed: 'Generating...',
};

const GENERATION_URL = process.env.REACT_APP_GENERATION_URL || 'http://localhost:1234';

interface CadChatProps {
  /** When set, the chat operates in refinement mode — sends to /refine instead of /cad/chat */
  refinementTaskId?: string;
}

const CadChat: React.FC<CadChatProps> = ({ refinementTaskId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { setActualFile } = useFile();
  const userInformation = useSelector((state: RootState) => state.userInterfaceState.userInformation);
  const cadState = useSelector((state: RootState) => state.cadState);
  const cadSettings = cadState.cadGenerationSettings;
  const chatState = useSelector((state: RootState) => state.cadChatState);
  const isRefinementMode = !!refinementTaskId;

  const [sketchOpen, setSketchOpen] = useState(false);
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const sketchElementsRef = useRef<any[]>([]);

  // Streaming state — local, not Redux, to avoid dispatching on every token
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const streamingRef = useRef('');

  // Start a chat session (creates task on backend) on mount
  useEffect(() => {
    const initChat = async () => {
      if (!chatState.taskId && !isRefinementMode && userInformation?.user?.user_id) {
        try {
          const { task_id } = await startChatSession(userInformation.user.user_id);
          dispatch(startChat({ taskId: task_id }));
        } catch (err) {
          console.error('Failed to start chat session:', err);
        }
      }
    };
    initChat();
  }, [chatState.taskId, isRefinementMode, userInformation, dispatch]);

  // Reset generating phase when entering refinement mode
  useEffect(() => {
    if (isRefinementMode && chatState.phase === 'generating') {
      dispatch(setPhase({ phase: 'confirmed' }));
    }
  }, [isRefinementMode, chatState.phase, dispatch]);

  const handleSend = async (content: string, images: string[]) => {
    if (!userInformation?.user?.user_id) return;

    // Collect images (uploaded + sketch)
    const allImages = [...images];
    if (sketchDataUrl) {
      allImages.push(sketchDataUrl);
      setSketchDataUrl(null);
    }

    // Strip data: prefix for backend (keep data URLs for display)
    const base64Images = allImages.map((img) =>
      img.startsWith('data:') ? img.split(',')[1] : img
    );

    const userMsg: ChatMessage = {
      id: generateUuid(),
      role: 'user',
      content,
      images: allImages,
      timestamp: Date.now(),
    };

    dispatch(addUserMessage({ message: userMsg }));

    // Always use the chat endpoint for conversation (both pre- and post-generation)
    if (!chatState.taskId) return;

    streamingRef.current = '';
    setStreamingText('');

    await sendChatMessageStreaming(
      chatState.taskId,
      userInformation.user.user_id,
      content,
      base64Images,
      cadSettings,
      (token: string) => {
        streamingRef.current += token;
        setStreamingText(streamingRef.current);
      },
      (response) => {
        setStreamingText(null);
        streamingRef.current = '';

        const assistantMsg: ChatMessage = {
          id: generateUuid(),
          role: 'assistant',
          content: response.reply || '(Empty response)',
          timestamp: Date.now(),
          phase: response.phase || 'freeform',
          spec: response.spec ?? undefined,
        };

        dispatch(addAssistantMessage({ message: assistantMsg }));
      },
      (errorMsg: string) => {
        setStreamingText(null);
        streamingRef.current = '';
        dispatch(setChatError({ error: errorMsg }));
      },
    );
  };

  const handleRefineAction = async (instruction: string, images: string[]) => {
    if (!refinementTaskId || !userInformation?.user?.user_id) return;

    // Add user message to chat history
    const userMsg: ChatMessage = {
      id: generateUuid(),
      role: 'user',
      content: `🔧 ${instruction}`,
      images,
      timestamp: Date.now(),
    };
    dispatch(addUserMessage({ message: userMsg }));

    const portId = generateUuid();
    try {
      dispatch(setCadOperationType({ cadOperationType: 'refine' }));
      dispatch(setCadPending({ cadPending: true }));
      dispatch(setCadLoading({ cadLoading: true }));

      const resp = await fetch(`${GENERATION_URL}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          task_id: refinementTaskId,
          port_id: portId,
          user_id: userInformation.user.user_id,
          instruction,
          max_iterations: cadSettings.max_iterations,
          timeout_seconds: cadSettings.timeout_seconds,
        }),
      });

      if (!resp.ok) throw new Error(`Refinement failed: ${resp.statusText}`);

      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      connectProgressStream(portId, 'cad', dispatch, setActualFile);

      const refineMsg: ChatMessage = {
        id: generateUuid(),
        role: 'assistant',
        content: 'Refining your model...',
        timestamp: Date.now(),
      };
      dispatch(addAssistantMessage({ message: refineMsg }));
    } catch (err: any) {
      logger.error('Refinement error:', err);
      dispatch(setCadLoading({ cadLoading: false }));
      dispatch(setCadPending({ cadPending: false }));
      dispatch(setChatError({ error: err.message || 'Refinement failed' }));
    }
  };

  const handleApprove = async (spec: Record<string, any>) => {
    if (!chatState.taskId || !userInformation?.user?.user_id) return;

    const portId = generateUuid();
    dispatch(setPhase({ phase: 'generating' }));
    dispatch(setCadPending({ cadPending: true }));

    try {
      await confirmSpec(
        chatState.taskId,
        userInformation.user.user_id,
        portId,
        spec,
        cadSettings,
      );
      dispatch(authApi.util.invalidateTags([{ type: 'sessionData' }]));
      connectProgressStream(portId, 'cad', dispatch, setActualFile);
    } catch (err: any) {
      dispatch(setChatError({ error: err.message || 'Failed to start generation' }));
      dispatch(setCadPending({ cadPending: false }));
      dispatch(setPhase({ phase: 'confirmation' }));
    }
  };

  const handleEdit = () => {
    // User continues chatting — phase stays at confirmation
  };

  const handleSketchAttach = (dataUrl: string) => {
    setSketchDataUrl(dataUrl);
    setSketchOpen(false);
  };

  const isRefining = cadState.cadPending || cadState.cadLoading;
  const isDisabled = chatState.isWaitingForReply || (!isRefinementMode && chatState.phase === 'generating') || (isRefinementMode && isRefining);
  const isStreaming = streamingText !== null;
  const phaseLabel = PHASE_LABELS[chatState.phase] || '';

  // Build display messages: Redux messages + streaming in-progress message
  const displayMessages = [...chatState.messages];
  if (isStreaming) {
    // Strip the ```json block from display while streaming
    let visibleText = streamingText;
    const jsonBlockStart = visibleText.lastIndexOf('```json');
    if (jsonBlockStart !== -1) {
      visibleText = visibleText.slice(0, jsonBlockStart).trim();
    }

    if (visibleText) {
      displayMessages.push({
        id: 'streaming',
        role: 'assistant',
        content: visibleText,
        timestamp: Date.now(),
      });
    }
  }

  // Show generation progress as a system message
  if (chatState.phase === 'generating') {
    const pct = cadState.cadLoadedPercentage;
    const status = cadState.cadStatusMessage || 'Starting generation...';
    displayMessages.push({
      id: 'generating',
      role: 'assistant',
      content: `**Generating your model** — ${status} (${pct}%)`,
      timestamp: Date.now(),
    });
  }

  return (
    <div style={{ width: '100%' }}>
      {!isRefinementMode && <CadDesignIntent />}

      {/* Chat container — fixed 400px height, flex column, overflow hidden */}
      <div
        style={{
          height: '400px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${borderSubtle}`,
          borderRadius: '12px',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Header — fixed height */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderBottom: `1px solid ${borderSubtle}`,
            backgroundColor: bgHighlight,
          }}
        >
          <SmartToyIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
            Design Assistant
          </Typography>
          {phaseLabel && chatState.phase !== 'idle' && (
            <Chip
              label={phaseLabel}
              size="small"
              sx={{ fontSize: '0.7rem', height: 22, borderColor: borderSubtle, color: 'primary.main' }}
              variant="outlined"
            />
          )}
        </div>

        {/* Messages — takes ALL remaining space, scrolls internally */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
          {displayMessages.length === 0 && !chatState.isWaitingForReply ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Box sx={{ textAlign: 'center' }}>
                <SmartToyIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1, opacity: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                  Tell me what you want to build. I'll ask a few questions to
                  make sure the design is right before generating.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  You can also attach photos or sketches for reference.
                </Typography>
              </Box>
            </Box>
          ) : (
            <>
              {displayMessages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onApprove={handleApprove}
                  onEdit={handleEdit}
                />
              ))}
              {chatState.isWaitingForReply && !isStreaming && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1, mb: 1 }}>
                  <CircularProgress size={14} sx={{ color: 'primary.main' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Thinking...
                  </Typography>
                </Box>
              )}
            </>
          )}
        </div>

        {/* Sketch panel — opens as a dialog */}
        <Suspense fallback={null}>
          <SketchPanel
            open={sketchOpen}
            onClose={() => setSketchOpen(false)}
            onAttach={handleSketchAttach}
            initialElements={sketchElementsRef.current}
            onElementsChange={(elements) => { sketchElementsRef.current = elements; }}
          />
        </Suspense>

        {/* Sketch attached indicator */}
        {sketchDataUrl && (
          <div style={{ flexShrink: 0, padding: '4px 16px' }}>
            <Chip
              label="Sketch attached"
              size="small"
              color="primary"
              onDelete={() => setSketchDataUrl(null)}
              sx={{ fontSize: '0.7rem' }}
            />
          </div>
        )}

        {/* Error */}
        {chatState.error && (
          <div style={{ flexShrink: 0, padding: '4px 16px' }}>
            <Typography variant="caption" color="error.main">
              {chatState.error}
            </Typography>
          </div>
        )}

        {/* Input — pinned at bottom */}
        {(isRefinementMode || chatState.phase !== 'generating') && (
          <div style={{ flexShrink: 0, borderTop: `1px solid ${borderSubtle}` }}>
            <ChatInput
              onSend={handleSend}
              onRefine={isRefinementMode ? handleRefineAction : undefined}
              disabled={isDisabled || isStreaming}
              placeholder={
                isRefinementMode
                  ? 'Chat about the model, or use the wand to apply changes...'
                  : chatState.messages.length === 0
                    ? 'Describe what you want to build...'
                    : chatState.phase === 'confirmation'
                      ? 'Request changes, or approve the spec above...'
                      : 'Reply...'
              }
              onToggleSketch={() => setSketchOpen((prev) => !prev)}
              sketchOpen={sketchOpen}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CadChat;
