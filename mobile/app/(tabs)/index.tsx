import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
// expo-file-system used for cache directory only
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSelector } from 'react-redux';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { API_URL, GENERATION_URL, MEDIA_URL } from '../../src/services/config';
import { getToken } from '../../src/services/auth';
import { api } from '../../src/services/api';
import type { RootState } from '../../src/store';

type Mode = 'cad' | 'mesh';
type GenerationState = 'idle' | 'generating' | 'uploading' | 'done';

export default function GenerateScreen() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<Mode>('cad');
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; type: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const progressAnim = useRef(new Animated.Value(0)).current;

  // For adding to basket after upload/generation
  const [uploadFile] = api.useUpdateBasketQuantityMutation();

  const animateProgress = (to: number) => {
    Animated.timing(progressAnim, {
      toValue: to,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setProgress(to);
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/octet-stream', 'model/stl', 'model/obj', 'application/step', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const ext = asset.name.split('.').pop()?.toLowerCase() || '';
        const supported = ['stl', 'obj', 'step', 'stp', 'glb', 'gltf', 'jpg', 'jpeg', 'png'];

        if (!supported.includes(ext)) {
          Alert.alert('Unsupported File', `File type .${ext} is not supported.\n\nSupported: ${supported.join(', ')}`);
          return;
        }

        setSelectedFile({ name: asset.name, uri: asset.uri, type: ext });
        setFileName(asset.name.replace(/\.[^/.]+$/, ''));

        // If it has a thumbnail endpoint, show preview
        setPreviewUrl(null);
        setGenState('idle');
      }
    } catch (err) {
      console.error('Document picker error:', err);
    }
  };

  const handleUploadToBasket = async () => {
    if (!selectedFile || !user) return;

    setGenState('uploading');
    setStatusMessage('Uploading file...');
    animateProgress(20);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: 'application/octet-stream',
      } as any);
      formData.append('name', fileName || selectedFile.name);
      formData.append('material', 'PLA Basic');
      formData.append('technique', 'FDM');
      formData.append('sizing', '1');
      formData.append('colour', 'white');
      formData.append('selectedFileType', selectedFile.type);

      animateProgress(50);
      setStatusMessage('Uploading...');

      const res = await fetch(`${API_URL}/file_storage`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Upload failed');
      }

      animateProgress(100);
      setStatusMessage('Added to basket!');
      setGenState('done');

      Alert.alert('Success', `${fileName || selectedFile.name} added to your basket.`);
    } catch (err: any) {
      setGenState('idle');
      animateProgress(0);
      Alert.alert('Upload Failed', err.message || 'Something went wrong');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !user) return;

    setGenState('generating');
    setStatusMessage('Starting generation...');
    animateProgress(5);

    try {
      const token = await getToken();
      const portId = `mobile-${Date.now()}`;

      // Start generation task — use mock endpoint if MOCK_GENERATION is on
      const isMock = process.env.EXPO_PUBLIC_MOCK_GENERATION === 'true';

      let endpoint: string;
      let body: any;

      if (isMock) {
        endpoint = `${GENERATION_URL}/mock/generate`;
        body = {
          name: prompt.trim(),
          type: mode === 'cad' ? 'cad' : 'meshy',
          user_id: user.user_id,
          port_id: portId,
        };
      } else if (mode === 'cad') {
        endpoint = `${GENERATION_URL}/start_cad_task/`;
        body = { prompt: prompt.trim(), user_id: user.user_id, port_id: portId };
      } else {
        endpoint = `${GENERATION_URL}/start_task/`;
        body = {
          user_id: user.user_id,
          port_id: portId,
          meshy_payload: {
            mode: 'preview',
            prompt: prompt.trim(),
            art_style: 'realistic',
            negative_prompt: '',
            ai_model: 'meshy-4',
          },
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error('Failed to start generation');
      }

      // Connect to SSE progress stream
      setStatusMessage('Generating...');
      animateProgress(10);

      const progressRes = await fetch(`${GENERATION_URL}/progress/${portId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!progressRes.ok || !progressRes.body) {
        throw new Error('Failed to connect to progress stream');
      }

      const reader = progressRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();

          if (data.startsWith('Task Completed')) {
            animateProgress(100);
            setStatusMessage('Generation complete!');
            setGenState('done');

            const parts = data.split(',');
            const taskId = parts[1];
            if (taskId) {
              setPreviewUrl(`${MEDIA_URL}/thumbnail/${taskId}`);
              setFileName(parts[2] || prompt.slice(0, 30));
            }
          } else if (data.startsWith('Task Failed')) {
            throw new Error('Generation failed');
          } else {
            // Progress update: "percentage,status,name" or "percentage,taskId,name"
            const pctMatch = data.match(/^(\d+)/);
            if (pctMatch) {
              const pct = parseInt(pctMatch[1], 10);
              animateProgress(pct);
              const statusPart = data.split(',')[1] || '';
              setStatusMessage(statusPart || `${pct}%`);
            }
          }
        }
      }
    } catch (err: any) {
      setGenState('idle');
      animateProgress(0);
      Alert.alert('Generation Failed', err.message || 'Something went wrong');
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setGenState('idle');
    setProgress(0);
    setStatusMessage('');
    setFileName('');
    setPrompt('');
    progressAnim.setValue(0);
  };

  const isGenerating = genState === 'generating' || genState === 'uploading';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <Text style={styles.title}>FITD</Text>
          <Text style={styles.subtitle}>Decentralised Manufacturing</Text>

          {/* Preview / Result */}
          {(previewUrl || selectedFile) && (
            <View style={styles.previewSection}>
              <View style={styles.previewHeader}>
                <TextInput
                  style={styles.fileNameInput}
                  value={fileName}
                  onChangeText={setFileName}
                  placeholder="File name"
                  placeholderTextColor={colors.textDisabled}
                />
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                  <FontAwesome name="times" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.previewContainer}>
                {previewUrl ? (
                  <Image
                    source={{ uri: previewUrl }}
                    style={styles.previewImage}
                    contentFit="contain"
                    transition={200}
                  />
                ) : (
                  <View style={styles.previewPlaceholder}>
                    <FontAwesome name="file-o" size={48} color={colors.cyan} />
                    <Text style={styles.previewFileName}>{selectedFile?.name}</Text>
                  </View>
                )}
              </View>

              {genState !== 'generating' && selectedFile && !previewUrl && (
                <TouchableOpacity style={styles.addToBasketButton} onPress={handleUploadToBasket}>
                  <FontAwesome name="shopping-basket" size={16} color={colors.bgBase} />
                  <Text style={styles.addToBasketText}>Add to Basket</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Progress Bar */}
          {isGenerating && (
            <View style={styles.progressSection}>
              <View style={styles.progressBarBg}>
                <Animated.View style={[styles.progressBarFill, {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                }]} />
              </View>
              <View style={styles.progressRow}>
                <ActivityIndicator size="small" color={colors.cyan} />
                <Text style={styles.progressText}>{statusMessage}</Text>
              </View>
            </View>
          )}

          {/* Upload Section */}
          {!selectedFile && genState === 'idle' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upload 3D Model</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickFile}>
                <FontAwesome name="cloud-upload" size={32} color={colors.cyan} />
                <Text style={styles.uploadTitle}>Tap to select a file</Text>
                <Text style={styles.uploadSubtext}>STL, OBJ, STEP, GLB, JPG, PNG</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AI Generation Section */}
          {!selectedFile && genState === 'idle' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AI Generation</Text>

              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'cad' && styles.modeActive]}
                  onPress={() => setMode('cad')}
                >
                  <FontAwesome name="cog" size={14} color={mode === 'cad' ? colors.bgBase : colors.textSecondary} />
                  <Text style={[styles.modeText, mode === 'cad' && styles.modeTextActive]}>CAD (Claude)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'mesh' && styles.modeActive]}
                  onPress={() => setMode('mesh')}
                >
                  <FontAwesome name="magic" size={14} color={mode === 'mesh' ? colors.bgBase : colors.textSecondary} />
                  <Text style={[styles.modeText, mode === 'mesh' && styles.modeTextActive]}>Mesh (Meshy)</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.promptInput}
                placeholder={mode === 'cad'
                  ? 'Describe an engineering part...\ne.g. "A mounting bracket with 4 M6 bolt holes"'
                  : 'Describe a 3D model...\ne.g. "A medieval castle with stone walls"'
                }
                placeholderTextColor={colors.textDisabled}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.charCount}>{prompt.length} / 500</Text>

              <TouchableOpacity
                style={[styles.generateButton, (!prompt.trim() || !user) && styles.generateButtonDisabled]}
                onPress={handleGenerate}
                disabled={!prompt.trim() || !user}
              >
                <FontAwesome name="magic" size={16} color={colors.bgBase} />
                <Text style={styles.generateButtonText}>
                  {mode === 'cad' ? 'Generate CAD Model' : 'Generate 3D Mesh'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Done state */}
          {genState === 'done' && !selectedFile && (
            <View style={styles.doneRow}>
              <TouchableOpacity style={styles.newButton} onPress={handleClear}>
                <FontAwesome name="plus" size={14} color={colors.cyan} />
                <Text style={styles.newButtonText}>New Model</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  title: { fontSize: 32, fontWeight: '700', color: colors.cyan, textAlign: 'center', marginTop: spacing.lg, letterSpacing: 3, fontFamily: 'SpaceMono' },
  subtitle: { fontSize: fontSizes.caption, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },

  // Preview
  previewSection: { backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  previewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  fileNameInput: { flex: 1, backgroundColor: colors.bgInput, borderColor: colors.cyanSubtle, borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: fontSizes.body },
  clearButton: { padding: spacing.md },
  previewContainer: { height: 250, backgroundColor: colors.bgElevated, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  previewFileName: { color: colors.textSecondary, fontSize: fontSizes.caption },
  addToBasketButton: { backgroundColor: colors.cyan, borderRadius: borderRadius.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  addToBasketText: { color: colors.bgBase, fontSize: fontSizes.body, fontWeight: '600' },

  // Progress
  progressSection: { backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  progressBarBg: { height: 4, backgroundColor: colors.bgElevated, borderRadius: 2, overflow: 'hidden', marginBottom: spacing.md },
  progressBarFill: { height: '100%', backgroundColor: colors.cyan, borderRadius: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressText: { color: colors.textSecondary, fontSize: fontSizes.caption },

  // Upload
  section: { backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  uploadButton: { borderColor: colors.cyanSubtle, borderWidth: 2, borderStyle: 'dashed', borderRadius: borderRadius.lg, paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  uploadTitle: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '500' },
  uploadSubtext: { color: colors.textDisabled, fontSize: fontSizes.caption },

  // Mode toggle
  modeToggle: { flexDirection: 'row', backgroundColor: colors.bgInput, borderRadius: borderRadius.md, padding: spacing.xs, marginBottom: spacing.md },
  modeButton: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm, flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  modeActive: { backgroundColor: colors.cyan },
  modeText: { color: colors.textSecondary, fontSize: fontSizes.body, fontWeight: '500' },
  modeTextActive: { color: colors.bgBase },

  // Prompt
  promptInput: { backgroundColor: colors.bgInput, borderColor: colors.cyanSubtle, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, color: colors.textPrimary, fontSize: fontSizes.body, minHeight: 100, marginBottom: spacing.xs },
  charCount: { fontSize: fontSizes.badge, color: colors.textDisabled, textAlign: 'right', marginBottom: spacing.md },
  generateButton: { backgroundColor: colors.cyan, borderRadius: borderRadius.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  generateButtonDisabled: { opacity: 0.4 },
  generateButtonText: { color: colors.bgBase, fontSize: fontSizes.body, fontWeight: '600' },

  // Done
  doneRow: { alignItems: 'center', marginTop: spacing.md },
  newButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderColor: colors.cyan, borderWidth: 1, borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  newButtonText: { color: colors.cyan, fontSize: fontSizes.body, fontWeight: '600' },
});
