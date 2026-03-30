import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';

export default function GenerateScreen() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'cad' | 'mesh'>('cad');

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        console.log('Selected file:', result.assets[0].name);
      }
    } catch (err) {
      console.error('Document picker error:', err);
    }
  };

  const handleGenerate = () => {
    console.log('Generate:', { prompt, mode });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>FITD</Text>
        <Text style={styles.subtitle}>Decentralised Manufacturing</Text>

        {/* Upload Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload 3D Model</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
            <FontAwesome name="cloud-upload" size={24} color={colors.cyan} />
            <Text style={styles.uploadText}>STL, OBJ, or STEP</Text>
          </TouchableOpacity>
        </View>

        {/* AI Generation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Generation</Text>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'cad' && styles.modeActive]}
              onPress={() => setMode('cad')}
            >
              <Text style={[styles.modeText, mode === 'cad' && styles.modeTextActive]}>
                CAD
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'mesh' && styles.modeActive]}
              onPress={() => setMode('mesh')}
            >
              <Text style={[styles.modeText, mode === 'mesh' && styles.modeTextActive]}>
                Mesh
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.promptInput}
            placeholder={
              mode === 'cad'
                ? 'Describe an engineering part...'
                : 'Describe a 3D model...'
            }
            placeholderTextColor={colors.textDisabled}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
            <FontAwesome name="magic" size={16} color={colors.bgBase} style={styles.buttonIcon} />
            <Text style={styles.generateButtonText}>Generate</Text>
          </TouchableOpacity>
        </View>

        {/* 3D Viewer Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.viewerPlaceholder}>
            <FontAwesome name="cube" size={48} color={colors.cyanSubtle} />
            <Text style={styles.viewerText}>3D Viewer</Text>
            <Text style={styles.viewerSubtext}>
              Upload or generate a model to preview
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.cyan,
    textAlign: 'center',
    marginTop: spacing.lg,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: fontSizes.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  section: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSizes.sectionTitle,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  uploadButton: {
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  modeActive: {
    backgroundColor: colors.cyan,
  },
  modeText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: '500',
  },
  modeTextActive: {
    color: colors.bgBase,
  },
  promptInput: {
    backgroundColor: colors.bgInput,
    borderColor: colors.cyanSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    minHeight: 80,
    marginBottom: spacing.md,
  },
  generateButton: {
    backgroundColor: colors.cyan,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  generateButtonText: {
    color: colors.bgBase,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  viewerPlaceholder: {
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    gap: spacing.sm,
  },
  viewerText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sectionTitle,
    fontWeight: '500',
  },
  viewerSubtext: {
    color: colors.textDisabled,
    fontSize: fontSizes.caption,
  },
});
