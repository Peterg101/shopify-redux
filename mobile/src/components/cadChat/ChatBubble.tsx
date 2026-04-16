import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ChatMessage } from '../../types/cad';
import { SpecCard } from './SpecCard';
import { colors, spacing, fontSizes, borderRadius } from '../../theme';

interface ChatBubbleProps {
  message: ChatMessage;
  onApprove?: (spec: Record<string, any>) => void;
  onEdit?: () => void;
}

export function ChatBubble({ message, onApprove, onEdit }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isRefineAction = isUser && message.content.startsWith('\uD83D\uDD27');
  const isConfirmation = message.phase === 'confirmation' && message.spec;

  const displayContent = isRefineAction ? message.content.slice(2).trim() : message.content;

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant]}>
      {/* Assistant label */}
      {!isUser && (
        <View style={styles.labelRow}>
          <FontAwesome name="android" size={12} color={colors.cyan} />
          <Text style={styles.labelText}>FITD Engineer</Text>
        </View>
      )}

      {/* Bubble */}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          isRefineAction && styles.bubbleRefine,
        ]}
      >
        {isRefineAction && (
          <View style={styles.refineBadge}>
            <Text style={styles.refineBadgeText}>Refine</Text>
          </View>
        )}
        <Text style={styles.content}>{displayContent}</Text>

        {/* Images */}
        {message.images && message.images.length > 0 && (
          <View style={styles.imageRow}>
            {message.images.map((img, i) => (
              <Image
                key={i}
                source={{ uri: img.startsWith('data:') ? img : `data:image/png;base64,${img}` }}
                style={styles.image}
                contentFit="cover"
              />
            ))}
          </View>
        )}
      </View>

      {/* Spec card */}
      {isConfirmation && message.spec && onApprove && onEdit && (
        <View style={styles.specContainer}>
          <SpecCard spec={message.spec} onApprove={onApprove} onEdit={onEdit} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
    maxWidth: '85%',
  },
  wrapperUser: {
    alignSelf: 'flex-end',
  },
  wrapperAssistant: {
    alignSelf: 'flex-start',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    marginLeft: 4,
  },
  labelText: {
    fontSize: fontSizes.badge,
    color: colors.textSecondary,
  },
  bubble: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: colors.bgElevated,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    borderTopRightRadius: 2,
  },
  bubbleAssistant: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderTopLeftRadius: 2,
  },
  bubbleRefine: {
    backgroundColor: 'rgba(118, 255, 3, 0.06)',
    borderColor: 'rgba(118, 255, 3, 0.25)',
  },
  refineBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(118, 255, 3, 0.4)',
    marginBottom: spacing.xs,
  },
  refineBadgeText: {
    fontSize: fontSizes.badge - 1,
    color: colors.neonGreen,
  },
  content: {
    fontSize: fontSizes.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  imageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  image: {
    width: 150,
    height: 112,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  specContainer: {
    marginTop: spacing.sm,
  },
});
