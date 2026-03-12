import { useDispatch } from 'react-redux'
import { useFile } from '../services/fileProvider'
import { fetchFile, extractFileInfo, fetchCadFile, isCadFileType } from '../services/fetchFileUtils'
import { setSelectedFile, setFulfillFileViewProperties } from '../services/dataSlice'
import { setFulfillMode } from '../services/userInterfaceSlice'
import { Order } from '../app/utility/interfaces'

export const useOrderFileLoader = () => {
  const dispatch = useDispatch()
  const { setActualFile } = useFile()

  const prepareOrderFile = async (order: Order) => {
    let file: File;
    let fileUrl: string;

    if (isCadFileType(order.selectedFileType)) {
      const cadResult = await fetchCadFile(order.task_id!);
      file = cadResult.file;
      fileUrl = cadResult.fileUrl;
    } else {
      const data = await fetchFile(order.task_id!)
      if (!data) throw new Error('File not found or could not be fetched.')
      const fileInfo = extractFileInfo(data, order.name)
      if (!fileInfo?.fileUrl) throw new Error('Failed to extract file information.')
      file = fileInfo.file;
      fileUrl = fileInfo.fileUrl;
    }

    const fileInfo = { file, fileUrl, fileBlob: new Blob([await file.arrayBuffer()]) };
    setActualFile(file)
    dispatch(setSelectedFile({ selectedFile: fileUrl }))
    dispatch(setFulfillFileViewProperties({ order, fileInformation: fileInfo }))
    dispatch(setFulfillMode({ fulfillMode: true }))

    return fileInfo
  }

  return { prepareOrderFile }
}
