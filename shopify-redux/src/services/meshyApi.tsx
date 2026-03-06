import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

interface FileMetadata {
  file: File;
  metadata: string;
}

export interface MeshyPayload {
    mode: string;
    prompt: string;
    art_style: string;
    negative_prompt: string;
    ai_model: string;
    topology?: string;
    target_polycount?: number;
    symmetry_mode?: string;
  }


export interface MeshyImageTo3DPayload {
  image_url: string;
  enable_pbr: boolean;
  should_remesh: boolean;
  should_texture: boolean;
  ai_model: string;
  topology?: string;
  target_polycount?: number;
  symmetry_mode?: string;
  texture_prompt?: string;
}
  
export interface MeshyTaskGeneratedResponse {
result: string; 
  }

export interface MeshyTaskStatusArgs {
    task_id: string
}

export interface ModelUrls{
    glb: string
    fbx: string
    usdz: string
    obj: string
    mtl: string
}
    
export interface MeshyTaskStatusResponse {
  id: string;
  mode: string;
  name: string;
  seed: number;
  art_style: string;
  texture_richness: string;
  prompt: string;
  negative_prompt: string;
  status: string;
  created_at: number;
  progress: number;
  started_at: number;
  finished_at: number;
  task_error?: string | null;
  model_urls: ModelUrls;
  thumbnail_url: string;
  video_url: string;
  texture_urls?: { [key: string]: string } | null;
  preceding_tasks?: number | null;
  obj_file_blob?: Base64URLString
};

export interface MeshyRefinePayload {
    mode: 'refine';
    preview_task_id: string;
    enable_pbr?: boolean;
    texture_prompt?: string;
    remove_lighting?: boolean;
}

export const meshyApi = createApi({
  reducerPath: 'meshyApi',
  baseQuery: fetchBaseQuery({ baseUrl: `${process.env.REACT_APP_MESHY_SERVICE}/api/` }),
  endpoints: (builder) => ({
    meshyGenerateTask: builder.mutation<MeshyTaskGeneratedResponse, MeshyPayload>({
      query: (payload) => ({
        url: 'meshy_request',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
});

// Export the hooks
export const { useMeshyGenerateTaskMutation } = meshyApi
