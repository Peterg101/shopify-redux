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

export interface UserInterfaceState {
    leftDrawerOpen: boolean
    selectedComponent: string
    userInformation: SlimSession | null
    claimedOrder: Order
    selectedClaim: Claim | null
    fulfillMode: boolean
    updateClaimMode: boolean
}

export interface CadGenerationSettings {
  max_iterations: number;
  timeout_seconds: number;
  target_units: string;
  process: string;
  approximate_size: { width: number | null; depth: number | null; height: number | null } | null;
  material_hint: string;
  features: string[];
}

export interface CadState {
  cadLoading: boolean;
  cadLoadedPercentage: number;
  cadPending: boolean;
  cadGenerationSettings: CadGenerationSettings;
  cadError: string | null;
  cadStatusMessage: string | null;
  cadOperationType: string | null;
}

// ---------------------------------------------------------------------------
// CAD Chat (conversational pre-generation)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];  // base64 data
  timestamp: number;
  phase?: 'freeform' | 'guided' | 'confirmation' | 'confirmed';
  spec?: Record<string, any>;
}

export interface CadChatState {
  taskId: string | null;
  messages: ChatMessage[];
  phase: 'idle' | 'freeform' | 'guided' | 'confirmation' | 'confirmed' | 'generating';
  currentSpec: Record<string, any> | null;
  isWaitingForReply: boolean;
  error: string | null;
}

export interface CadChatResponse {
  task_id: string;
  reply: string;
  phase: 'freeform' | 'guided' | 'confirmation' | 'confirmed';
  spec: Record<string, any> | null;
}

export interface CadFeature {
  tag: string;
  type: string;
  position: [number, number, number];
  dimensions?: Record<string, number>;
  step?: number;
  depends_on?: string[];
  error?: string;
}

export interface CadFace {
  id: string;
  type: string;
  center: [number, number, number];
  area: number;
  normal?: [number, number, number];
}

export interface CadEdge {
  id: string;
  type: string;
  center: [number, number, number];
  length: number;
}

export interface StepMetadata {
  jobId?: string;
  processingStatus?: "pending" | "processing" | "complete" | "failed";
  progress?: number;
  previewUrl?: string;
  boundingBox?: { x: number; y: number; z: number };
  volumeMm3?: number;
  surfaceAreaMm2?: number;
  features?: CadFeature[];
  faces?: CadFace[];
  suppressed?: string[];
  edges?: CadEdge[];
  currentVersion?: number;
  totalVersions?: number;
}

export interface DataState {
   taskId: string
   modelColour: string
   selectedFile: string
   selectedFileType: string
   printTechnique: string
   printMaterial: string
   processId: string | null
   materialId: string | null
   processFamily: string | null
   modelVolume: number
   modelDimensions: VectorState
   multiplierValue: number
   maxScale: number
   minScale: number
   fileNameBoxValue: string
   fileDisplay: boolean
   autoScaleOnLoad: boolean
   xFlip: number
   yFlip: number
   zFlip: number
   materialCost: number
   qaLevel: "standard" | "high"
   toleranceMm?: number
   surfaceFinish?: string
   stepMetadata?: StepMetadata
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
  file_type: string;
  complete: boolean;
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
  selectedFile: string;
  quantity: number;
  selectedFileType: string; // Changed to snake_case
  price: number
  process_id?: string;
  material_id?: string;
  tolerance_mm?: number;
  surface_finish?: string;
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
  process_id?: string;
  material_id?: string;
  tolerance_mm?: number;
  surface_finish?: string;
  special_requirements?: string;
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

// ── Manufacturing & Fulfiller Profile Interfaces ─────────────────────

export interface ManufacturingProcess {
  id: string;
  family: string;
  name: string;
  display_name: string;
}

export interface ManufacturingMaterial {
  id: string;
  category: string;
  name: string;
  process_family: string;
}

export interface FulfillerCapability {
  id: string;
  process_id: string;
  process: ManufacturingProcess;
  materials?: string[];
  notes?: string;
}

export interface FulfillerCapabilityCreate {
  process_id: string;
  materials?: string[];
  notes?: string;
}

export interface FulfillerProfileCreate {
  business_name: string;
  description?: string;
  max_build_volume_x?: number;
  max_build_volume_y?: number;
  max_build_volume_z?: number;
  min_tolerance_mm?: number;
  lead_time_days_min?: number;
  lead_time_days_max?: number;
  certifications?: string[];
  post_processing?: string[];
  capabilities: FulfillerCapabilityCreate[];
}

export interface FulfillerProfile {
  id: string;
  user_id: string;
  business_name: string;
  description?: string;
  max_build_volume_x?: number;
  max_build_volume_y?: number;
  max_build_volume_z?: number;
  min_tolerance_mm?: number;
  lead_time_days_min?: number;
  lead_time_days_max?: number;
  certifications?: string[];
  post_processing?: string[];
  is_active: boolean;
  capabilities: FulfillerCapability[];
}

// ── Parts Catalog Interfaces ─────────────────────────────────────────

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
  status: "draft" | "published" | "archived";
  is_public: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
}

export interface PartCreate {
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
  status?: string;
}

export interface PartUpdate {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  recommended_process?: string;
  recommended_material?: string;
  status?: string;
}

export interface PartListResponse {
  parts: Part[];
  total: number;
  page: number;
  page_size: number;
}

export interface PartOrderConfig {
  material?: string;
  technique?: string;
  quantity?: number;
  sizing?: number;
  colour?: string;
  price?: number;
  tolerance_mm?: number;
  surface_finish?: string;
}

export interface SlimSession {
  user: UserInformation;
  stripe_onboarded: boolean;
  has_fulfiller_profile: boolean;
  email_verified: boolean;
  incomplete_task: TaskInformationAndPortId | null;
  subscription_tier: string;
  subscription_status: string;
  available_credits: number;
  credit_renewal_date: string | null;
}

// ── Billing ─────────────────────────────────────────────────

export interface SubscriptionInfo {
  tier: string;
  status: string;
  available_credits: number;
  credits_used: number;
  credit_renewal_date: string | null;
  current_period_end: string | null;
}

export interface BillingTransaction {
  id: string;
  type: string;
  description: string;
  credits: number;
  amount_cents: number;
  created_at: string;
}

export interface TransactionsResponse {
  transactions: BillingTransaction[];
  total: number;
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

// ── Messaging ────────────────────────────────────────────────

export interface MessageResponse {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

export interface ConversationListItem {
  id: string;
  claim_id: string;
  buyer_user_id: string;
  fulfiller_user_id: string;
  created_at: string;
  updated_at: string;
  last_message?: MessageResponse;
  unread_count: number;
}

export interface UnreadCountResponse {
  total_unread: number;
}

// ── Stepwise CAD Builder ────────────────────────────────────

export interface BuildStep {
  step: number;
  feature: string;
  description: string;
  depends_on: number[];
}

export interface StepExecutionResult {
  success: boolean;
  job_id?: string;
  new_code?: string;
  full_script?: string;
  metadata?: Record<string, any>;
  error?: string;
}