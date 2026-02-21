import { UUID } from 'crypto'
import { BasketItem, FileAndItem, UploadedFile, UUIDType } from './interfaces'
import { v4 as uuidv4 } from 'uuid'

export const removeItemByUUID = <T extends { id: UUID }>(
  uuid: UUID,
  itemList: T[]
): T[] => {
  return itemList.filter((item) => item.id !== uuid)
}

export const deleteFileAndBasketItemFromArray = (
  uuid: UUID,
  uploadedFiles: UploadedFile[],
  basketItems: BasketItem[]
) => {
  const newUploadedFiles = removeItemByUUID(uuid, uploadedFiles)
  const newBasketItems = removeItemByUUID(uuid, basketItems)
  return { newUploadedFiles, newBasketItems }
}

export const combineBasketItem = (
  uuid: UUID,
  uploadedFiles: UploadedFile[],
  basketItems: BasketItem[]
): FileAndItem => {
  const uploadedFile = findItemFromUUID<UploadedFile>(uuid, uploadedFiles)
  const basketItem = findItemFromUUID<BasketItem>(uuid, basketItems)

  const fileAndItem: FileAndItem = {
    basketItem: basketItem!,
    uploadedFile: uploadedFile!,
  }

  return fileAndItem
}

export const findItemFromUUID = <T extends { id: UUID }>(
  uuid: UUID,
  itemList: T[]
): T | undefined => {
  return itemList.find((item) => item.id === uuid)
}

export function generateUuid(): UUIDType {
  return uuidv4() as UUIDType
}
