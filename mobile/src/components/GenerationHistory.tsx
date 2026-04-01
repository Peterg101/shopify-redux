import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../theme';
import { MEDIA_URL } from '../services/config';
import { api } from '../services/api';

interface Task {
  task_id: string;
  user_id: string;
  task_name: string;
  file_type: string;
  created_at: string;
}

interface GenerationHistoryProps {
  onSelectTask: (task: Task) => void;
}

const formatRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export function GenerationHistory({ onSelectTask }: GenerationHistoryProps) {
  const { data: tasks, isLoading } = api.useGetUserTasksQuery(undefined, {
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
  });

  if (isLoading) return null;
  if (!tasks || tasks.length === 0) return null;

  const renderTask = ({ item }: { item: Task }) => {
    const thumbnailUrl = `${MEDIA_URL}/thumbnail/${item.task_id}`;

    return (
      <TouchableOpacity
        style={styles.taskCard}
        activeOpacity={0.7}
        onPress={() => onSelectTask(item)}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="contain"
            transition={200}
          />
        </View>

        {/* Info */}
        <View style={styles.taskInfo}>
          <Text style={styles.taskName} numberOfLines={1}>{item.task_name}</Text>
          <View style={styles.taskMeta}>
            <View style={styles.fileTypeChip}>
              <Text style={styles.fileTypeText}>{item.file_type.toUpperCase()}</Text>
            </View>
            <Text style={styles.timestamp}>{formatRelativeTime(item.created_at)}</Text>
          </View>
        </View>

        {/* Edit arrow */}
        <FontAwesome name="chevron-right" size={12} color={colors.textDisabled} style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FontAwesome name="history" size={16} color={colors.textSecondary} />
        <Text style={styles.headerTitle}>Recent Generations</Text>
      </View>

      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item: Task) => item.task_id}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSizes.sectionTitle,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cyanSubtle,
  },
  thumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  taskInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  taskName: {
    fontSize: fontSizes.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileTypeChip: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  fileTypeText: {
    fontSize: fontSizes.badge,
    color: colors.cyan,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: fontSizes.caption,
    color: colors.textDisabled,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});
