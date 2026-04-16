import { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fontSizes, borderRadius } from '../../theme';

interface ChatInputProps {
  onSend: (content: string, images: string[]) => void;
  onRefine?: (content: string, images: string[]) => void;
  disabled: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onRefine,
  disabled,
  placeholder = 'Describe what you want to build...',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed && pendingImages.length === 0) return;
    onSend(trimmed || '(attached image)', pendingImages);
    setValue('');
    setPendingImages([]);
  };

  const handleRefineClick = () => {
    if (!onRefine) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onRefine(trimmed, pendingImages);
    setValue('');
    setPendingImages([]);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets
        .filter((a) => a.base64)
        .map((a) => `data:image/jpeg;base64,${a.base64}`);
      setPendingImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <View>
      {/* Pending image previews */}
      {pendingImages.length > 0 && (
        <View style={styles.previewRow}>
          {pendingImages.map((img, i) => (
            <View key={i} style={styles.previewContainer}>
              <Image source={{ uri: img }} style={styles.previewImage} contentFit="cover" />
              <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(i)}>
                <FontAwesome name="times" size={10} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handlePickImage}
          disabled={disabled}
        >
          <FontAwesome
            name="camera"
            size={18}
            color={disabled ? colors.textDisabled : colors.textSecondary}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          multiline
          maxLength={500}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          value={value}
          onChangeText={setValue}
          editable={!disabled}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleSend}
          disabled={disabled || (!value.trim() && pendingImages.length === 0)}
        >
          <FontAwesome
            name="send"
            size={16}
            color={
              disabled || (!value.trim() && pendingImages.length === 0)
                ? colors.textDisabled
                : colors.cyan
            }
          />
        </TouchableOpacity>

        {onRefine && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleRefineClick}
            disabled={disabled || !value.trim()}
          >
            <FontAwesome
              name="magic"
              size={16}
              color={disabled || !value.trim() ? colors.textDisabled : colors.neonGreen}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  previewContainer: {
    position: 'relative',
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    padding: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
  },
  textInput: {
    flex: 1,
    maxHeight: 80,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
  },
});
