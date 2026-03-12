# Frontend Architecture (shopify-redux)

## Tech Stack

- **React 18** with functional components + hooks
- **TypeScript 5.7** — strict mode
- **MUI 5** — dark theme, glassmorphism styling, cyan (#00E5FF) accent
- **Redux Toolkit 2.x** — state management + RTK Query for auth
- **React Three Fiber** + Three.js — 3D model rendering
- **React Router** — client-side routing

## Directory Structure

```
shopify-redux/src/
├── app/
│   ├── store.ts              # Redux store configuration
│   └── utility/
│       ├── interfaces.ts     # All TypeScript interfaces
│       ├── pricingConfig.json # Static pricing data
│       └── threeUtils.ts     # Three.js helper functions
├── features/
│   ├── display/              # 3D viewers, file display
│   │   ├── objStlViewer.tsx  # OBJ/STL viewer (Meshy files)
│   │   ├── gltfScene.tsx     # glTF/glB viewer (CAD files)
│   │   ├── ModelThumbnail.tsx # Thumbnail renderer (routes by file_type)
│   │   ├── cadLoading.tsx    # CAD generation progress UI
│   │   └── meshyLoading.tsx  # Meshy generation progress UI
│   ├── userInterface/
│   │   ├── AppRouter.tsx     # Route definitions
│   │   ├── leftDrawerFragments.tsx # Task list sidebar
│   │   └── editBasketItem.tsx     # Basket item editor
│   ├── data/
│   │   ├── dataSlice.tsx     # File/model state (selectedFile, fileType, etc.)
│   │   └── dataSelectors.ts  # Memoized selectors
│   ├── cad/
│   │   ├── cadSlice.tsx      # CAD generation state
│   │   └── cadPanel.tsx      # CAD prompt input UI
│   ├── meshy/
│   │   └── meshySlice.tsx    # Meshy generation state
│   └── configuration/
│       ├── ConfigurationPanel.tsx  # Material/technique/sizing selection
│       └── pricingUtils.ts        # Cost calculation logic
├── services/
│   ├── fetchFileUtils.tsx    # API calls: fetchFile, fetchCadFile, isCadFileType
│   ├── cadWebsocket.tsx      # WebSocket connection to cad_service
│   ├── meshyApi.tsx          # Meshy generation API
│   └── authApi.tsx           # RTK Query auth endpoints
└── hooks/
    ├── useOrderFileLoader.ts # Loads files for order detail view
    └── useSyncTotalCost.ts   # Pricing sync hook
```

## State Management

### Redux Slices

| Slice | Key State | Purpose |
|-------|-----------|---------|
| `dataSlice` | selectedFile, selectedFileType, fileNameBoxValue, fromMeshyOrHistory | Current file/model being viewed |
| `cadSlice` | cadLoading, cadError, cadPending | CAD generation progress |
| `meshySlice` | meshyLoading, meshyError, meshyPending | Meshy generation progress |
| `userSlice` | userId, email, tasks, orders, claims, basket | User data from hydration |
| `configSlice` | printTechnique, printMaterial, sizing, processId, materialId | Configuration panel state |

### RTK Query (authApi)

- `useLoginMutation` / `useRegisterMutation` / `useGoogleLoginMutation`
- `useGetSessionQuery` — session validation
- `useLogoutMutation`

## File Type Routing

The frontend uses `isCadFileType(fileType)` to route file operations:

```typescript
// fetchFileUtils.tsx
const CAD_FILE_TYPES = new Set(['glb', 'step', 'gltf']);
export const isCadFileType = (fileType: string): boolean => CAD_FILE_TYPES.has(fileType);
```

**Meshy files** (OBJ/STL/FBX): `fetchFile(taskId)` → `GET /file_storage/{task_id}` on db_service → binary file from disk

**CAD files** (glB/STEP): `fetchCadFile(taskId)` → `GET /step/by_task/{task_id}/preview_url` on step_service → presigned MinIO URL → binary fetch

### Consumers of file type routing:

| Component | How it routes |
|-----------|---------------|
| `leftDrawerFragments.tsx` | `handleGetFile(taskId, name, fileType)` checks `isCadFileType` |
| `ModelThumbnail.tsx` | Routes thumbnail fetch by `fileType` prop |
| `useOrderFileLoader.ts` | Routes by `order.selectedFileType` |
| `editBasketItem.tsx` | Routes by `item.selectedFileType` |
| `cadWebsocket.tsx` | Always fetches from step_service (CAD-only component) |

## 3D Viewers

| Viewer | File Types | Renderer |
|--------|-----------|----------|
| `OBJSTLViewer` | OBJ, STL, FBX | Three.js OBJLoader/STLLoader with OrbitControls |
| `GLTFScene` | glB, glTF | React Three Fiber with useGLTF |

The file display component selects the viewer based on `selectedFileType`:
- `glb` / `gltf` → `<GLTFScene />`
- Everything else → `<OBJSTLViewer />`

## WebSocket Connections

### Meshy WebSocket (`meshyApi.tsx`)
- Connects to `ws://meshy_backend:1234/ws/{port_id}`
- Receives progress: `"{percentage},{task_id},{name}"`
- On completion: `"Task Completed,{task_id},{name}"` → calls `fetchFile(taskId)`

### CAD WebSocket (`cadWebsocket.tsx`)
- Connects to `ws://cad_service:1236/ws/{port_id}`
- Receives progress: `"{percentage},{status},{name}"`
- On completion: `"Task Completed,{task_id},{name},{job_id}"` → fetches glB from step_service via presigned URL
- Dispatches `setFileProperties({ selectedFile: blobUrl, selectedFileType: 'glb' })`

## Styling Conventions

- **Background:** #0A0E14
- **Paper surfaces:** Glassmorphism with rgba backgrounds
- **Accent color:** Cyan #00E5FF
- **Border radius:** 3 for cards/papers
- **Status chips:** Color-coded by claim lifecycle phase
- **All styling via MUI `sx` prop** — no external CSS files

## User Hydration Flow

```
1. App mounts → useGetSessionQuery() checks for active session
2. If authenticated → GET /users/{user_id} returns:
   {
     user_id, email, name, avatar_url,
     tasks: TaskInformation[],     // includes file_type field
     orders: OrderResponse[],
     claims: ClaimResponse[],
     basket_items: BasketItemResponse[],
     fulfiller_profile: FulfillerProfileResponse | null
   }
3. Redux store populated → UI renders task list, orders, etc.
```

## Testing

- **Framework:** Jest + React Testing Library + MSW 2.x
- **Pattern:** `renderWithProviders()` wraps components in Redux Provider + Router
- **Mocks:** MSW handlers in `mswHandlers.ts`, mock data in `mockData.ts`
- **Known failures:** 3 test suites fail due to Three.js ESM import issue (pre-existing, not regressions)
- **Run:** `CI=true npx react-scripts test --watchAll=false`
