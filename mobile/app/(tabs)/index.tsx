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
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSelector, useDispatch } from 'react-redux';
import { colors, spacing, fontSizes, borderRadius } from '../../src/theme';
import { API_URL, MEDIA_URL } from '../../src/services/config';
import { GenerationHistory } from '../../src/components/GenerationHistory';
import { getToken } from '../../src/services/auth';
import { api } from '../../src/services/api';
import { CadChat } from '../../src/components/cadChat/CadChat';
import { ModelViewer } from '../../src/components/ModelViewer';
import { resetCadState } from '../../src/store/cadSlice';
import { resetConversation } from '../../src/store/cadChatSlice';
import type { RootState, AppDispatch } from '../../src/store';

type ViewState = 'create' | 'uploading' | 'preview';

export default function GenerateScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const cadState = useSelector((state: RootState) => state.cadState);

  const [viewState, setViewState] = useState<ViewState>('create');
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; type: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [submitFeedback] = api.useSubmitFeedbackMutation();
  const progressAnim = useRef(new Animated.Value(0)).current;

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/octet-stream', 'model/stl', 'model/obj', 'application/step', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const ext = asset.name.split('.').pop()?.toLowerCase() || '';
        const supported = ['stl', 'obj', 'step', 'stp', 'glb', 'gltf'];

        if (!supported.includes(ext)) {
          Alert.alert('Unsupported File', `File type .${ext} is not supported.\n\nSupported: ${supported.join(', ')}`);
          return;
        }

        setSelectedFile({ name: asset.name, uri: asset.uri, type: ext });
        setFileName(asset.name.replace(/\.[^/.]+$/, ''));
        setPreviewUrl(null);
      }
    } catch (err) {
      console.error('Document picker error:', err);
    }
  };

  const handleUploadToBasket = async () => {
    if (!selectedFile || !user) return;

    setViewState('uploading');
    Animated.timing(progressAnim, { toValue: 20, duration: 200, useNativeDriver: false }).start();

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

      Animated.timing(progressAnim, { toValue: 50, duration: 300, useNativeDriver: false }).start();

      const res = await fetch(`${API_URL}/file_storage`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Upload failed');
      }

      Animated.timing(progressAnim, { toValue: 100, duration: 200, useNativeDriver: false }).start();
      setViewState('preview');
      Alert.alert('Success', `${fileName || selectedFile.name} added to your basket.`);
    } catch (err: any) {
      setViewState('create');
      progressAnim.setValue(0);
      Alert.alert('Upload Failed', err.message || 'Something went wrong');
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setGlbUrl(null);
    setViewState('create');
    setFileName('');
    progressAnim.setValue(0);
    dispatch(resetCadState());
    dispatch(resetConversation());
  };

  const handleModelReady = (url: string) => {
    setGlbUrl(url);
    if (cadState.completedModel) {
      setFileName(cadState.completedModel.fileName);
    }
  };

  const handleSelectHistoryTask = (task: any) => {
    setPreviewUrl(`${MEDIA_URL}/thumbnail/${task.task_id}`);
    setFileName(task.task_name);
    setViewState('preview');
  };

  const showCreateView = viewState === 'create' && !selectedFile;

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

          {/* File preview (uploaded file or completed generation) */}
          {(selectedFile || glbUrl || previewUrl) && viewState !== 'create' && (
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

              {glbUrl ? (
                <ModelViewer glbUrl={glbUrl} />
              ) : previewUrl ? (
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: previewUrl }}
                    style={styles.previewImage}
                    contentFit="contain"
                    transition={200}
                  />
                </View>
              ) : (
                <View style={styles.previewContainer}>
                  <View style={styles.previewPlaceholder}>
                    <FontAwesome name="file-o" size={48} color={colors.cyan} />
                    <Text style={styles.previewFileName}>{selectedFile?.name}</Text>
                  </View>
                </View>
              )}

              {selectedFile && !previewUrl && !glbUrl && viewState !== 'uploading' && (
                <TouchableOpacity style={styles.addToBasketButton} onPress={handleUploadToBasket}>
                  <FontAwesome name="shopping-basket" size={16} color={colors.bgBase} />
                  <Text style={styles.addToBasketText}>Add to Basket</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 3D viewer for generated model (when CadChat produced one) */}
          {glbUrl && viewState === 'create' && (
            <View style={styles.modelSection}>
              <View style={styles.previewHeader}>
                <Text style={styles.modelName}>{cadState.completedModel?.fileName || 'Generated Model'}</Text>
                {cadState.completedModel?.taskId && (
                  <TouchableOpacity
                    onPress={async () => {
                      if (liked || !cadState.completedModel?.taskId) return;
                      try {
                        await submitFeedback({ taskId: cadState.completedModel.taskId, rating: 'up' });
                        setLiked(true);
                        Alert.alert('Thanks!', 'This design will help improve future generations.');
                      } catch { /* non-critical */ }
                    }}
                    style={{ padding: spacing.sm }}
                  >
                    <FontAwesome
                      name={liked ? 'thumbs-up' : 'thumbs-o-up'}
                      size={18}
                      color={liked ? colors.cyan : colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                  <FontAwesome name="times" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
              <ModelViewer glbUrl={glbUrl} />
            </View>
          )}

          {/* Upload Section */}
          {showCreateView && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upload 3D Model</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickFile}>
                <FontAwesome name="cloud-upload" size={32} color={colors.cyan} />
                <Text style={styles.uploadTitle}>Tap to select a file</Text>
                <Text style={styles.uploadSubtext}>STL, OBJ, STEP, GLB</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Divider */}
          {showCreateView && (
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* CAD Chat */}
          {showCreateView && (
            <CadChat onModelReady={handleModelReady} />
          )}

          {/* Generation History */}
          {showCreateView && (
            <View style={{ marginTop: spacing.lg }}>
              <GenerationHistory onSelectTask={handleSelectHistoryTask} />
            </View>
          )}

          {/* Done state — new model button */}
          {(viewState === 'preview' || glbUrl) && (
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

  // Model
  modelSection: { backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  modelName: { flex: 1, fontSize: fontSizes.body, fontWeight: '600', color: colors.textPrimary },

  // Upload
  section: { backgroundColor: colors.bgSurface, borderColor: colors.cyanSubtle, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontSize: fontSizes.sectionTitle, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  uploadButton: { borderColor: colors.cyanSubtle, borderWidth: 2, borderStyle: 'dashed', borderRadius: borderRadius.lg, paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  uploadTitle: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '500' },
  uploadSubtext: { color: colors.textDisabled, fontSize: fontSizes.caption },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.cyanSubtle },
  dividerText: { paddingHorizontal: spacing.lg, fontSize: fontSizes.caption, color: colors.textDisabled, fontWeight: '600' },

  // Done
  doneRow: { alignItems: 'center', marginTop: spacing.lg },
  newButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderColor: colors.cyan, borderWidth: 1, borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  newButtonText: { color: colors.cyan, fontSize: fontSizes.body, fontWeight: '600' },
});
