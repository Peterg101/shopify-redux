import { UUID } from "crypto";
import * as THREE from 'three';
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
    meshyLoading: boolean,
    meshyLoadedPercentage: number,
    meshyPending: boolean,
    meshyQueueItems: number,
    isLoggedIn: boolean
    userInformation: UserAndTasks | null

}

export interface DataState {
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
   fileDisplay: boolean
   xFlip: number,
   yFlip: number,
   zFlip: number
}

export interface FileAndItem {
    uploadedFile: UploadedFile,
    basketItem: BasketItem
}

export interface DrawerProps {
    open: boolean;
    drawerWidth: number;
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

export interface UserAndTasks{
  user: UserInformation
  tasks: TaskInformation[]
}

export interface FileResponse {
  file_id: string;
  file_data: string; 
}