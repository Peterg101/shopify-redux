import { FileInformation, FileResponse, BasketInformationAndFile} from "../app/utility/interfaces"

export const fetchFile = async (fileId: string): Promise<FileResponse> => {
    try {
      const response = await fetch(`http://localhost:8000/file_storage/${fileId}`, {
        method: 'GET',
        credentials: 'include'
      });
  
      if (!response.ok) {
        throw new Error(`Failed to fetch file with ID ${fileId}: ${response.statusText}`);
      }
  
      const data: FileResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching file:", error);
      throw error;
    }
  };

export const extractFileInfo = (fileResponse: FileResponse, filename: string): FileInformation => {
    const byteCharacters = atob(fileResponse.file_data);
    const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
    const fileData = new Uint8Array(byteNumbers)
    const blob = new Blob([fileData], { type: "application/octet-stream" });
    const file = new File([blob], filename, { type: "application/octet-stream" });
    const fileURL = URL.createObjectURL(file);

    const fileInfo: FileInformation = {
        file: file,
        fileBlob: blob,
        fileUrl: fileURL,
    };  

    return fileInfo
    
}

export const postFile = async (basketInformationAndFile: BasketInformationAndFile) => {
  try {
    const response = await fetch(`http://localhost:8000/file_storage`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basketInformationAndFile),
    });

    if (!response.ok) {
      throw new Error(`Failed to post file ${basketInformationAndFile.name}: ${response.statusText}`);
    }

  } catch (error) {
    console.error("Error fetching file:", error);
    throw error;
  }
};