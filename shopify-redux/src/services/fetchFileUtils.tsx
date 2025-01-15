import { FileInformation, FileResponse, BasketInformationAndFile} from "../app/utility/interfaces"
import { MeshyPayload } from "../services/meshyApi";
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


export const deleteBasketItem = async (fileId: string): Promise<void> => {
  
  try {
      const response = await fetch(`http://localhost:8000/file_storage/${fileId}`, {
          method: "DELETE",
          credentials: "include", // Include cookies in the request
          headers: {
              "Content-Type": "application/json",
          },
      });

      if (!response.ok) {
          const errorDetails = await response.json();
          console.error("Failed to delete basket item:", errorDetails);
          throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      console.log(`Successfully deleted file with ID: ${fileId}`);
  } catch (error) {
      console.error("Error deleting basket item:", error);
      throw error; // Propagate the error
  }
}

export const startTask = async (prompt: string, userId: string, portId: string) => {
  console.log('clicked 2');
  const payload: MeshyPayload = {
    mode: 'preview',
    prompt: prompt,
    art_style: 'realistic',
    negative_prompt: 'low quality, low resolution, low poly, ugly',
  };

  const response = await fetch('http://localhost:1234/start_task/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json', // Specify that you're sending JSON data

    },
    body: JSON.stringify({ port_id: portId, user_id: userId, meshy_payload: payload }),
  });

  const data = await response.json();
  console.log(data.message); // This will be "Task started!"
};