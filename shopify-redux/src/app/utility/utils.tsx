import { 
  BasketInformation, 
  BasketItem, 
  DataState, 
  FileAndItem, 
  PricingConfig, 
  UploadedFile, 
  UUIDType, 
  UserInformation, 
  Order } from "./interfaces";
import { UUID } from "crypto";
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';


export const removeItemByUUID = <T extends { id: UUID }>(
  uuid: UUID, 
  itemList: T[]
): T[] => {
  return itemList.filter(item => item.id !== uuid);
};

export const deleteFileAndBasketItemFromArray = (
    uuid: UUID, 
    uploadedFiles: UploadedFile[], 
    basketItems: BasketItem[]
  )=> {
    const newUploadedFiles = removeItemByUUID(uuid, uploadedFiles)
    const newBasketItems = removeItemByUUID(uuid, basketItems)
    return {newUploadedFiles, newBasketItems}
  }

export const combineBasketItem = (
    uuid: UUID, 
    uploadedFiles: UploadedFile[], 
    basketItems: BasketItem[]
  ): FileAndItem => {
    const uploadedFile = findItemFromUUID<UploadedFile>(uuid, uploadedFiles);
    const basketItem = findItemFromUUID<BasketItem>(uuid, basketItems);
    
const fileAndItem: FileAndItem = {
  basketItem: basketItem!,
  uploadedFile: uploadedFile!
};

return fileAndItem;
};

export const findItemFromUUID = <T extends { id: UUID }>(
  uuid: UUID, 
  itemList: T[]
): T | undefined => {
  const foundItem = itemList.find(item => item.id === uuid);
  return foundItem;
};

export const createFileBlob = (file: File): string => {
  const fileBlob = URL.createObjectURL(file)
  return fileBlob
}


export const extractFileType = (file: File): string => {
  const fileName = file.name;
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension || '';
};

export function calculateThreeVolume(mesh: THREE.Mesh<any, any, any> , precision: boolean):number {
  let volumen = 0;
  const vertices = mesh.geometry.attributes.position.array;
  let indices = mesh.geometry.index ? mesh.geometry.index.array : null;
  function volumenTriangular(p1: any, p2: any, p3:any) {
    const v321 = p3.x * p2.y * p1.z;
    const v231 = p2.x * p3.y * p1.z;
    const v312 = p3.x * p1.y * p2.z;
    const v132 = p2.x * p1.y * p3.z;
    const v213 = p1.x * p3.y * p2.z;
    const v123 = p1.x * p2.y * p3.z;
    return (1.0 / 6.0) * (-v321 + v231 + v312 - v132 - v213 + v123);
  }
  
  if (!indices) {
    indices = Array.from({ length: vertices.length / 3 }, (_, i) => i);
  }

  for (let i = 0; i < indices.length; i += 3) {
    const a = new THREE.Vector3().fromArray(vertices, indices[i] * 3);
    const b = new THREE.Vector3().fromArray(vertices, indices[i + 1] * 3);
    const c = new THREE.Vector3().fromArray(vertices, indices[i + 2] * 3);
    volumen += volumenTriangular(a, b, c);
  }
  if(precision){
    return (Math.abs(volumen/10));

  }else{
    return (Math.abs((volumen/1000)));
  }
}

export function calculateSize(mesh: any) {
  const boundingBox = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  const boundingBoxSize = boundingBox.getSize(size);
  
  return boundingBoxSize;
}

export function getLongestAxis(vector: THREE.Vector3): number{ 
  const { x, y, z } = vector;
  const maxValue  = Math.max(x,y,z)
  return maxValue
}

export function getShortestAxis(vector: THREE.Vector3): number{ 
  const { x, y, z } = vector;
  const minValue  = Math.min(x,y,z)
  return minValue 
}

export function calculateMaxScaling(initialModelDimensions: THREE.Vector3, ): number{
  const axisLength = 250
  const longestAxis = getLongestAxis(initialModelDimensions)
  const roundedScale = Number((axisLength/longestAxis).toFixed(2))
  return roundedScale
  
}

export function calculateMinScaling(initialModelDimensions: THREE.Vector3, ): number{
  const axisLength = 0.5
  const shortestAxis = getShortestAxis(initialModelDimensions)
  const roundedScale = Number((axisLength/ shortestAxis).toFixed(2))
  return roundedScale
  
}

export function generateUuid(): UUIDType {
return uuidv4() as UUIDType
}

export function getModelDimensions(dataState: DataState): THREE.Vector3{
  const {x, y, z } = dataState.modelDimensions.position
  const vector = new THREE.Vector3(x, y, z) 
  return vector
}

export function getMidPoint(minValue: number, maxValue: number): number {
  const midPoint = (minValue + maxValue)/2
  return midPoint
}

export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export async function convertFileToBase64WithoutFileReader(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(new Blob([uint8Array]));

    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result.split(',')[1]); // Extract Base64 part
      } else {
        reject(new Error("Failed to convert file to Base64"));
      }
    };

    reader.onerror = () => reject(new Error("FileReader encountered an error"));
  });
}

export function createBase64Blob(base64String: string, mimeType: string): Blob {
  const byteCharacters = atob(base64String); // Decode Base64
  const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0)); // Convert to bytes
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export async function convertFileToDataURI(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const binary = new Uint8Array(buffer);
  
  let binaryString = "";
  for (let i = 0; i < binary.length; i++) {
    binaryString += String.fromCharCode(binary[i]);
  }

  const base64String = btoa(binaryString); // Encode to Base64

  // Construct Data URI
  return `data:${file.type};base64,${base64String}`;
}

export function calculate3DPrintCost(volume: number, materialCost: number, markup: number = 1.2) {
  
  const postProcessing = { PLA: 5, ABS: 8, Resin: 10, Nylon: 7 };
  const baseCost = (volume * materialCost) + markup;
  return baseCost * markup;
}

export function getPrice (materialName: string, data:PricingConfig ): number | null {
  for (const technique in data.materials) {
    const material = data.materials[technique].find(m => m.name === materialName);
    if (material) return material.price;
  }
  return null; 
};

export function recalculateTotalCost(params: { modelVolume: number; materialCost: number; multiplierValue: number }): number {
  const { modelVolume, materialCost, multiplierValue } = params;

  if (![modelVolume, materialCost, multiplierValue].every(v => v > 0)) return 0;

  // Soft cap for large prints: sublinear scaling
  const volumeFactor = Math.pow(modelVolume, 0.8); // adjust exponent to control soft cap
  // Minimum cost floor to prevent tiny prints being too cheap
  const baseCost = 10; // e.g., $1 minimum

  return Math.max(baseCost, volumeFactor * materialCost * multiplierValue);
}

export function validateData (data: Record<string, any>, schema: Record<string, (value: any) => boolean>): string[] {
  return Object.entries(schema)
      .filter(([key, isValid]) => !isValid(data[key]))
      .map(([key]) => key);
};

export function calculateTotalBasketValue(basketItems: BasketInformation[]): number {
  if (basketItems.length == 0){
    return 0
  }
  const subtotal = basketItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  return subtotal
}

export function downloadBlob (blob: Blob, filename: string){
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export function visibleOrders(user: UserInformation,claimable_orders: Order[]): Order[] 
{
  return claimable_orders.filter((order) => {
    if (order.quantity_claimed == order.quantity) {
      return false;
    }
    const alreadyClaimedByUser = order.claims?.some(
      (claim) => claim.claimant_user_id === user.user_id
    );

    if (alreadyClaimedByUser) {
      return false;
    }

    return true;
  });
}