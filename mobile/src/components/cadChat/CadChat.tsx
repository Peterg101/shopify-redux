import { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import type { ChatMessage } from '../../types/cad';
import {
  startChat,
  addUserMessage,
  addAssistantMessage,
  setPhase,
  setChatError,
} from '../../store/cadChatSlice';
import { setCadPending, setCadLoading, setCadOperationType } from '../../store/cadSlice';
import {
  startChatSession,
  sendChatMessage,
  confirmSpec,
  fetchConversation,
} from '../../services/cadChatApi';
import { connectProgressStream } from '../../services/progressStream';
import { GENERATION_URL } from '../../services/config';
import { getToken } from '../../services/auth';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { DesignSettings } from '../DesignSettings';
import { colors, spacing, fontSizes, borderRadius } from '../../theme';

const PHASE_LABELS: Record<string, string> = {
  freeform: 'Understanding your design',
  guided: 'Clarifying details',
  confirmation: 'Ready to confirm',
  confirmed: 'Generating...',
};

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface CadChatProps {
  refinementTaskId?: string;
  onModelReady?: (glbUrl: string) => void;
}

export function CadChat({ refinementTaskId, onModelReady }: CadChatProps) {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const cadState = useSelector((state: RootState) => state.cadState);
  const cadSettings = cadState.cadGenerationSettings;
  const chatState = useSelector((state: RootState) => state.cadChatState);
  const isRefinementMode = !!refinementTaskId;
  const flatListRef = useRef<FlatList>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Notify parent when model is ready
  useEffect(() => {
    if (cadState.completedModel?.glbUrl && onModelReady) {
      onModelReady(cadState.completedModel.glbUrl);
    }
  }, [cadState.completedModel?.glbUrl, onModelReady]);

  // Reset generating phase when entering refinement mode
  useEffect(() => {
    if (isRefinementMode && chatState.phase === 'generating') {
      dispatch(setPhase({ phase: 'confirmed' }));
    }
  }, [isRefinementMode, chatState.phase, dispatch]);

  const handleSend = async (content: string, images: string[]) => {
    if (!user?.user_id) return;

    const base64Images = images.map((img) =>
      img.startsWith('data:') ? img.split(',')[1] : img,
    );

    const userMsg: ChatMessage = {
      id: generateUuid(),
      role: 'user',
      content,
      images,
      timestamp: Date.now(),
    };
    dispatch(addUserMessage({ message: userMsg }));

    // Lazy task creation
    let activeTaskId = chatState.taskId;
    if (!activeTaskId && !isRefinementMode) {
      try {
        const { task_id } = await startChatSession(user.user_id);
        dispatch(startChat({ taskId: task_id }));
        activeTaskId = task_id;
      } catch (err: any) {
        dispatch(setChatError({ error: err.message || 'Failed to start session' }));
        return;
      }
    }
    if (!activeTaskId) return;

    await sendChatMessage(
      activeTaskId,
      user.user_id,
      content,
      base64Images,
      cadSettings,
      () => {},
      (response) => {
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
      (errorMsg) => {
        dispatch(setChatError({ error: errorMsg }));
      },
    );
  };

  const handleRefineAction = async (instruction: string, images: string[]) => {
    if (!refinementTaskId || !user?.user_id) return;

    const userMsg: ChatMessage = {
      id: generateUuid(),
      role: 'user',
      content: `\uD83D\uDD27 ${instruction}`,
      images,
      timestamp: Date.now(),
    };
    dispatch(addUserMessage({ message: userMsg }));

    const portId = generateUuid();
    try {
      dispatch(setCadOperationType({ cadOperationType: 'refine' }));
      dispatch(setCadPending({ cadPending: true }));
      dispatch(setCadLoading({ cadLoading: true }));

      const token = await getToken();
      const resp = await fetch(`${GENERATION_URL}/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          task_id: refinementTaskId,
          port_id: portId,
          user_id: user.user_id,
          instruction,
          max_iterations: cadSettings.max_iterations,
          timeout_seconds: cadSettings.timeout_seconds,
        }),
      });

      if (!resp.ok) throw new Error(`Refinement failed: ${resp.statusText}`);

      cleanupRef.current?.();
      cleanupRef.current = connectProgressStream(portId, dispatch);

      const refineMsg: ChatMessage = {
        id: generateUuid(),
        role: 'assistant',
        content: 'Refining your model...',
        timestamp: Date.now(),
      };
      dispatch(addAssistantMessage({ message: refineMsg }));
    } catch (err: any) {
      dispatch(setCadLoading({ cadLoading: false }));
      dispatch(setCadPending({ cadPending: false }));
      dispatch(setChatError({ error: err.message || 'Refinement failed' }));
    }
  };

  const handleApprove = async (spec: Record<string, any>) => {
    if (!chatState.taskId || !user?.user_id) return;

    const portId = generateUuid();
    dispatch(setPhase({ phase: 'generating' }));
    dispatch(setCadPending({ cadPending: true }));

    try {
      await confirmSpec(chatState.taskId, user.user_id, portId, spec, cadSettings);
      cleanupRef.current?.();
      cleanupRef.current = connectProgressStream(portId, dispatch);
    } catch (err: any) {
      dispatch(setChatError({ error: err.message || 'Failed to start generation' }));
      dispatch(setCadPending({ cadPending: false }));
      dispatch(setPhase({ phase: 'confirmation' }));
    }
  };

  const handleEdit = () => {};

  // Build display messages
  const displayMessages = [...chatState.messages];

  if (chatState.phase === 'generating') {
    const pct = cadState.cadLoadedPercentage;
    const status = cadState.cadStatusMessage || 'Starting generation...';
    displayMessages.push({
      id: 'generating',
      role: 'assistant',
      content: `Generating your model \u2014 ${status} (${pct}%)`,
      timestamp: Date.now(),
    });
  }

  const isRefining = cadState.cadPending || cadState.cadLoading;
  const isDisabled =
    chatState.isWaitingForReply ||
    (!isRefinementMode && chatState.phase === 'generating') ||
    (isRefinementMode && isRefining);

  const phaseLabel = PHASE_LABELS[chatState.phase] || '';
  const showInput = isRefinementMode || chatState.phase !== 'generating';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <FontAwesome name="android" size={16} color={colors.cyan} />
        <Text style={styles.headerTitle}>Design Assistant</Text>
        <View style={{ flex: 1 }} />
        {phaseLabel && chatState.phase !== 'idle' && (
          <View style={styles.phaseChip}>
            <Text style={styles.phaseText}>{phaseLabel}</Text>
          </View>
        )}
      </View>

      {/* Design settings */}
      {!isRefinementMode && <DesignSettings />}

      {/* Messages */}
      <View style={styles.messagesContainer}>
        {displayMessages.length === 0 && !chatState.isWaitingForReply ? (
          <View style={styles.emptyState}>
            <FontAwesome name="android" size={28} color={colors.cyan} style={{ opacity: 0.5, marginBottom: spacing.sm }} />
            <Text style={styles.emptyText}>
              Tell me what you want to build. I'll ask a few questions to make sure the design is right.
            </Text>
            <Text style={styles.emptySubtext}>
              You can also attach photos for reference.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatBubble
                message={item}
                onApprove={handleApprove}
                onEdit={handleEdit}
              />
            )}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Waiting indicator */}
        {chatState.isWaitingForReply && (
          <View style={styles.waitingRow}>
            <ActivityIndicator size="small" color={colors.cyan} />
            <Text style={styles.waitingText}>Thinking...</Text>
          </View>
        )}
      </View>

      {/* Error */}
      {chatState.error && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{chatState.error}</Text>
        </View>
      )}

      {/* Input */}
      {showInput && (
        <View style={styles.inputContainer}>
          <ChatInput
            onSend={handleSend}
            onRefine={isRefinementMode ? handleRefineAction : undefined}
            disabled={isDisabled}
            placeholder={
              isRefinementMode
                ? 'Describe changes to the model...'
                : chatState.messages.length === 0
                  ? 'Describe what you want to build...'
                  : chatState.phase === 'confirmation'
                    ? 'Request changes, or approve above...'
                    : 'Reply...'
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cyanSubtle,
    backgroundColor: colors.bgElevated,
  },
  headerTitle: {
    fontSize: fontSizes.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  phaseChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  phaseText: {
    fontSize: fontSizes.badge,
    color: colors.cyan,
  },
  messagesContainer: {
    height: 320,
    minHeight: 200,
  },
  messagesList: {
    padding: spacing.sm,
    paddingBottom: spacing.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySubtext: {
    fontSize: fontSizes.caption,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  waitingText: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
  },
  errorRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  errorText: {
    fontSize: fontSizes.caption,
    color: colors.error,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.cyanSubtle,
  },
});
