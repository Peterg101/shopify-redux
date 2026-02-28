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
    leftDrawerOpen: boolean,
    rightDrawerOpen: boolean,
    basketItems: BasketItem[]
    drawerWidth: number
    selectedComponent: string,
    meshyLoading: boolean,
    meshyLoadedPercentage: number,
    meshyPending: boolean,
    meshyQueueItems: number,
    isLoggedIn: boolean,
    userInformation: UserAndTasksAndBasketAndIncompleteAndOrders | null,
    totalBasketValue: number,
    claimedOrder: Order,
    updateClaimedOrder: Claim | null
}

export interface DataState {
   taskId: string,
   modelColour: string,
   selectedFile: string,
   selectedFileType: string,
   printTechnique: string,
   printMaterial: string,
   modelVolume: number,
   modelDimensions: VectorState,
   multiplierValue: number,
   maxScale: number,
   minScale: number,
   fileNameBoxValue: string,
   fileDisplay: boolean,
   fromMeshyOrHistory: boolean,
   xFlip: number,
   yFlip: number,
   zFlip: number,
   displayObjectConfig: boolean,
   materialCost: number,
   totalCost: number,
   fulfillMode: boolean,
   updateClaimMode: boolean,
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
}

export interface Claim {
  id: string;
  order_id: string;
  claimant_user_id: string;
  order: Order
  quantity: number;
  status: "pending" | "in_progress" | "printing" | "shipped" | "delivered" | "accepted" | "disputed";
  created_at: string;
  updated_at: string;
  evidence?: ClaimEvidence[];
  status_history?: ClaimStatusHistory[];
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