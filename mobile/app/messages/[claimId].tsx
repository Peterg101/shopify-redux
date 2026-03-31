import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSelector } from 'react-redux';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { api } from '../../src/services/api';
import type { RootState } from '../../src/store';

interface Message {
  id: string;
  sender_user_id: string;
  sender_username: string;
  body: string;
  created_at: string;
}

export default function ClaimChatScreen() {
  const { claimId } = useLocalSearchParams<{ claimId: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { data: messages = [], isLoading } = api.useGetClaimMessagesQuery(
    { claimId: claimId! },
    { skip: !claimId, pollingInterval: 5000 },
  );
  const [sendMessage, { isLoading: isSending }] = api.useSendMessageMutation();
  const [markRead] = api.useMarkMessagesReadMutation();

  // Mark as read on open
  useEffect(() => {
    if (claimId) markRead(claimId);
  }, [claimId, markRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending || !claimId) return;
    try {
      await (sendMessage as any)({ claimId, body: trimmed }).unwrap();
      setMessageText('');
    } catch {}
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_user_id === user?.user_id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        {!isMe && (
          <Text style={styles.senderName}>{item.sender_username}</Text>
        )}
        <Text style={[styles.messageText, isMe && styles.myMessageText]}>{item.body}</Text>
        <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.cyan} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome name="comments-o" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textDisabled}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!messageText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.bgBase} />
            ) : (
              <FontAwesome name="send" size={16} color={colors.bgBase} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
  emptyTitle: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: fontSizes.caption, color: colors.textDisabled, textAlign: 'center' },
  messagesList: { padding: spacing.lg, paddingBottom: spacing.sm },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.cyan,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgSurface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  senderName: { fontSize: fontSizes.badge, color: colors.cyan, fontWeight: '600', marginBottom: spacing.xs },
  messageText: { fontSize: fontSizes.body, color: colors.textPrimary, lineHeight: 20 },
  myMessageText: { color: colors.bgBase },
  messageTime: { fontSize: 10, color: colors.textDisabled, marginTop: spacing.xs, textAlign: 'right' },
  myMessageTime: { color: 'rgba(10, 14, 20, 0.5)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.cyanSubtle,
    backgroundColor: colors.bgSurface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
});
