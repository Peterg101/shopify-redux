import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState } from 'react';
import { colors } from '../theme';

interface ModelViewerProps {
  glbUrl: string;
  style?: ViewStyle;
}

export function ModelViewer({ glbUrl, style }: ModelViewerProps) {
  const [loading, setLoading] = useState(true);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    body { background: ${colors.bgBase}; width: 100vw; height: 100vh; overflow: hidden; }
    model-viewer {
      width: 100%; height: 100%;
      --poster-color: ${colors.bgBase};
    }
  </style>
</head>
<body>
  <model-viewer
    src="${glbUrl}"
    auto-rotate
    camera-controls
    shadow-intensity="0.5"
    environment-image="neutral"
    loading="eager"
    style="width:100%;height:100%;"
  ></model-viewer>
</body>
</html>`;

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        scrollEnabled={false}
        bounces={false}
      />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.cyan} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.cyanSubtle,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
});
