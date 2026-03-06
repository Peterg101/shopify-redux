import { UUID } from "crypto";
//Basket items are safe to go in the redux store

export type UUIDType = `${string}-${string}-${string}-${string}-${string}`;

export interface BasketItem {
    id: UUIDType
    name: string
    material: string
    technique: string
    sizing: number
    colour: string
    selectedFile: string
    selectedFileType: string
  }

//Files are non serializable and so should be stored in the local state
export interface UploadedFile {
    id: UUID
    file: File
}

export interface MeshyGenerationSettings {
    ai_model: string;
    art_style: string;
    negative_prompt: string;
    topology: 'quad' | 'triangle';
    target_polycount: number;
    symmetry_mode: 'off' | 'auto' | 'on';
    enable_pbr: boolean;
    should_remesh: boolean;
    should_texture: boolean;
    texture_prompt: string;
}

export interface MeshyState {
    meshyLoading: boolean;
    meshyLoadedPercentage: number;
    meshyPending: boolean;
    meshyQueueItems: number;
    meshyGenerationSettings: MeshyGenerationSettings;
    meshyPreviewTaskId: string | null;
    meshyRefining: boolean;
}

export interface UserInterfaceState {
    leftDrawerOpen: boolean
    selectedComponent: string
    userInformation: UserAndTasksAndBasketAndIncompleteAndOrders | null
    claimedOrder: Order
    selectedClaim: Claim | null
    fulfillMode: boolean
    updateClaimMode: boolean
}

export interface DataState {
   taskId: string
   modelColour: string
   selectedFile: string
   selectedFileType: string
   printTechnique: string
   printMaterial: string
   modelVolume: number
   modelDimensions: VectorState
   multiplierValue: number
   maxScale: number
   minScale: number
   fileNameBoxValue: string
   fileDisplay: boolean
   fromMeshyOrHistory: boolean
   xFlip: number
   yFlip: number
   zFlip: number
   materialCost: number
   qaLevel: "standard" | "high"
}

export interface FileAndItem {
    uploadedFile: UploadedFile,
    basketItem: BasketItem
}

export interface VectorState {
    position: {
      x: number;
      y: number;
      z: number;
    };
  }


export interface UserInformation {
  user_id: string; 
  username: string; 
  email: string; 
}

export interface TaskInformation {
  task_id: string; 
  user_id: string; 
  task_name: string; 
  created_at: string;
}

export interface TaskInformationAndPortId extends TaskInformation {
  port: portIdInfo
}

export interface portIdInfo {
  port_id: string,
  task_id: string 
}

export interface BasketInformation {
  task_id: string; // Corresponds to "task_id" in the database
  user_id: string; // Corresponds to "user_id"
  name: string;
  material: string;
  technique: string;
  sizing: number;
  colour: string;
  selected_file: string; // Changed to snake_case
  quantity: number;
  selectedFileType: string; // Changed to snake_case
  price: number
}

export interface BasketInformationAndFile extends BasketInformation {
  file_blob: string// Matching FastAPI model
}

export interface ClaimEvidence {
  id: string;
  claim_id: string;
  file_path: string;
  uploaded_at: string;
  status_at_upload: string;
  description?: string;
  image_data?: string;
}

export interface ClaimStatusHistory {
  id: string;
  claim_id: string;
  previous_status: string;
  new_status: string;
  changed_by: string;
  changed_at: string;
}

export interface Order {
  order_id: string;
  user_id: string;
  task_id?: string;
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
  status: "open" | "in_progress" | "fulfilled";
  qa_level?: "standard" | "high";
  claims?: Claim[];
  shipping_name?: string;
  shipping_line1?: string;
  shipping_line2?: string;
  shipping_city?: string;
  shipping_postal_code?: string;
  shipping_country?: string;
}

export interface Dispute {
  id: string;
  claim_id: string;
  opened_by: string;
  reason: string;
  status: "open" | "responded" | "resolved";
  resolution?: "accepted" | "partial" | "rejected";
  resolution_amount_cents?: number;
  resolved_by?: "buyer" | "auto";
  fulfiller_response?: string;
  responded_at?: string;
  fulfiller_deadline: string;
  buyer_deadline?: string;
  created_at: string;
  resolved_at?: string;
}

export interface Claim {
  id: string;
  order_id: string;
  claimant_user_id: string;
  order: Order
  quantity: number;
  status: "pending" | "in_progress" | "printing" | "qa_check" | "shipped" | "delivered" | "accepted" | "disputed" | "resolved_accepted" | "resolved_partial" | "resolved_rejected" | "cancelled";
  created_at: string;
  updated_at: string;
  evidence?: ClaimEvidence[];
  status_history?: ClaimStatusHistory[];
  dispute?: Dispute;
  tracking_number?: string;
  label_url?: string;
  carrier_code?: string;
}


export interface ClaimDetail {
  id: string;
  order_id: string;
  claimant_user_id: string;
  claimant_username: string;
  quantity: number;
  status: Claim["status"];
  created_at: string;
  updated_at: string;
  evidence: ClaimEvidence[];
  status_history: ClaimStatusHistory[];
  dispute?: Dispute;
  tracking_number?: string;
  label_url?: string;
  carrier_code?: string;
}

export interface OrderDetail {
  order_id: string;
  task_id: string;
  user_id: string;
  owner_username: string;
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
  claims: ClaimDetail[];
  shipping_name?: string;
  shipping_line1?: string;
  shipping_line2?: string;
  shipping_city?: string;
  shipping_postal_code?: string;
  shipping_country?: string;
}

export interface FulfillerAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postal_code: string;
  country: string;
}

export interface UserAndTasksAndBasketAndIncompleteAndOrders{
  user: UserInformation
  tasks: TaskInformation[]
  basket_items: BasketInformation[],
  incomplete_task: TaskInformationAndPortId,
  orders: Order[]
  claimable_orders: Order[]
  claims: Claim[]
  stripe_onboarded?: boolean
}

export interface FileResponse {
  file_id: string;
  file_data: string; 
}

export interface FileInformation{
  file: File,
  fileBlob: Blob,
  fileUrl: string
}

export interface SidebarItem {
  text: string,
  icon: JSX.Element
}

export interface Material {
  name: string;
  price: number;
}

export interface PricingConfig {
  techniques: string[];
  materials: {
    FDM: Material[];
    Resin: Material[];
  };
}

export interface BasketQuantityUpdate {
  task_id: string
  quantity: number
}

export interface ClaimProps{
  open: boolean,
  handleClose: VoidFunction,
  order: Order
}

export interface ClaimOrder{
  order_id: string
  quantity: number
  status: string
}