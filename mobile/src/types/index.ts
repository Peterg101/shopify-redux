// Shared types — mirrors web app's interfaces.ts
// These will eventually be extracted to a shared package

export interface Part {
  id: string;
  publisher_user_id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  task_id: string;
  file_type: string;
  thumbnail_url?: string;
  bounding_box_x?: number;
  bounding_box_y?: number;
  bounding_box_z?: number;
  volume_cm3?: number;
  surface_area_cm2?: number;
  recommended_process?: string;
  recommended_material?: string;
  status: 'draft' | 'published' | 'archived';
  is_public: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
}

export interface PartListResponse {
  parts: Part[];
  total: number;
  page: number;
  page_size: number;
}

export interface Order {
  order_id: string;
  user_id: string;
  task_id: string;
  name: string;
  material: string;
  technique: string;
  sizing: number;
  colour: string;
  selectedFile: string;
  selectedFileType: string;
  price: number;
  quantity: number;
  quantity_claimed: number;
  created_at: string;
  is_collaborative: boolean;
  status: string;
  qa_level: string;
}

export interface Claim {
  id: string;
  order_id: string;
  claimant_user_id: string;
  quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserInfo {
  user_id: string;
  username: string;
  email: string;
}

export interface SlimSession {
  user: UserInfo;
  stripe_onboarded: boolean;
  has_fulfiller_profile: boolean;
  email_verified: boolean;
  incomplete_task: { task_id: string; port_id?: string } | null;
}
