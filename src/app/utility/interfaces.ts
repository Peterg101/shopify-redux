import { UUID } from "crypto";
import * as THREE from 'three';
//Basket items are safe to go in the redux store
export interface BasketItem {
    id: UUID
    name: string
    material: string
    technique: string
    sizing: number
    colour: string
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
}

export interface DataState {
   modelColour: string,
   selectedFile: string,
   selectedFileType: string,
   printTechnique: string,
   printMaterial: string,
   modelVolume: number,
   modelDimensions: THREE.Vector3 | null,
   multiplierValue: number,
   maxScale: number,
   minScale: number,
   fileNameBoxValue: string 
}

export interface FileAndItem {
    uploadedFile: UploadedFile,
    basketItem: BasketItem
}

export interface DrawerProps {
    open: boolean;
    drawerWidth: number;
  }
  