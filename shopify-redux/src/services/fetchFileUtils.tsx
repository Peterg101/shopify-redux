import { FileInformation, FileResponse, BasketInformationAndFile, BasketQuantityUpdate} from "../app/utility/interfaces"
import {convertFileToDataURI } from "../app/utility/utils";
import { MeshyPayload, MeshyImageTo3DPayload } from "../services/meshyApi";

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

  } catch (error) {
      console.error("Error deleting basket item:", error);
      throw error; // Propagate the error
  }
}

export const startTask = async (prompt: string, userId: string, portId: string) => {
  const payload: MeshyPayload = {
    mode: 'preview',
    prompt: prompt,
    art_style: 'realistic',
    negative_prompt: 'low quality, low resolution, low poly, ugly',
    ai_model: 'meshy-5'
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
};

export const startImageTo3DTask = async (image_file: File, userId: string, portId: string, fileName: string) => {
  const image_bytes = await convertFileToDataURI(image_file)
  const payload: MeshyImageTo3DPayload = {
    image_url: image_bytes,
    enable_pbr: true, 
    should_remesh: true,
    should_texture: true,
    ai_model: "meshy-5"
  };

  const response = await fetch('http://localhost:1234/start_image_to_3d_task/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json', // Specify that you're sending JSON data

    },
    body: JSON.stringify({ port_id: portId, user_id: userId, meshy_image_to_3d_payload: payload, filename: fileName}),
  });

  const data = await response.json();
};

export const updateBasketQuantity = async (basketQuantityUpdate: BasketQuantityUpdate): Promise<void> => {

  try {
    const response = await fetch(`http://localhost:8000/basket_item_quantity`, {
        method: "POST",
        credentials: "include", // Include cookies in the request
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(basketQuantityUpdate),
    });

    if (!response.ok) {
        const errorDetails = await response.json();
        console.error("Failed to update basket item:", errorDetails);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

} catch (error) {
    console.error("Error deleting basket item:", error);
    throw error; // Propagate the error
}

}

export async function createShopifyCheckoutAndRedirect() {
  try {
    const response = await fetch("http://localhost:369/checkout", {
      method: "POST",
      credentials: "include", // important if you're using cookies for auth
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // empty because your server gets user from cookies
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Checkout creation failed: ${errorText}`);
    }

    const data = await response.json();
    const checkoutUrl = data.checkout_url;
    window.location.href = checkoutUrl;

  } catch (error) {
    console.error("Error creating checkout:", error);
    alert("There was a problem creating the checkout. Please try again.");
  }
}

export async function callStripeService() {
  try {
    const response = await fetch("http://localhost:100/stripe/onboard", {
      method: "POST",
      credentials: "include", // important if you're using cookies for auth
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // empty because your server gets user from cookies
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Checkout creation failed: ${errorText}`);
    }

    // const data = await response.json();
    // const checkoutUrl = data.checkout_url;
    // window.location.href = checkoutUrl;

  } catch (error) {
    console.error("Error creating checkout:", error);
    alert("There was a problem creating the checkout. Please try again.");
  }
}