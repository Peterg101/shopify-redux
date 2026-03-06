import { FileInformation, FileResponse, BasketInformationAndFile, BasketQuantityUpdate, ClaimOrder, FulfillerAddress, MeshyGenerationSettings } from "../app/utility/interfaces"
import {convertFileToDataURI } from "../app/utility/utils";
import { MeshyPayload, MeshyImageTo3DPayload, MeshyRefinePayload } from "../services/meshyApi";

export const fetchFile = async (fileId: string): Promise<FileResponse> => {
    try {
      const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/file_storage/${fileId}`, {
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
    const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/file_storage`, {
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
      const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/file_storage/${fileId}`, {
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

export const startTask = async (prompt: string, userId: string, portId: string, settings?: MeshyGenerationSettings) => {
  try {
    const payload: MeshyPayload = {
      mode: 'preview',
      prompt: prompt,
      art_style: settings?.art_style ?? 'realistic',
      negative_prompt: settings?.negative_prompt ?? 'low quality, low resolution, low poly, ugly',
      ai_model: settings?.ai_model ?? 'meshy-5',
      ...(settings?.topology && { topology: settings.topology }),
      ...(settings?.target_polycount && { target_polycount: settings.target_polycount }),
      ...(settings?.symmetry_mode && { symmetry_mode: settings.symmetry_mode }),
    };

    const response = await fetch(`${process.env.REACT_APP_MESHY_SERVICE}/start_task/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ port_id: portId, user_id: userId, meshy_payload: payload }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start task: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error starting task:", error);
    throw error;
  }
};

export const startImageTo3DTask = async (image_file: File, userId: string, portId: string, fileName: string, settings?: MeshyGenerationSettings) => {
  try {
    const image_bytes = await convertFileToDataURI(image_file)
    const payload: MeshyImageTo3DPayload = {
      image_url: image_bytes,
      enable_pbr: settings?.enable_pbr ?? true,
      should_remesh: settings?.should_remesh ?? true,
      should_texture: settings?.should_texture ?? true,
      ai_model: settings?.ai_model ?? "meshy-5",
      ...(settings?.topology && { topology: settings.topology }),
      ...(settings?.target_polycount && { target_polycount: settings.target_polycount }),
      ...(settings?.symmetry_mode && { symmetry_mode: settings.symmetry_mode }),
      ...(settings?.texture_prompt && { texture_prompt: settings.texture_prompt }),
    };

    const response = await fetch(`${process.env.REACT_APP_MESHY_SERVICE}/start_image_to_3d_task/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ port_id: portId, user_id: userId, meshy_image_to_3d_payload: payload, filename: fileName}),
    });

    if (!response.ok) {
      throw new Error(`Failed to start image-to-3D task: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error starting image-to-3D task:", error);
    throw error;
  }
};

export const updateBasketQuantity = async (basketQuantityUpdate: BasketQuantityUpdate): Promise<void> => {

  try {
    const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/basket_item_quantity`, {
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

export async function createStripeCheckoutAndRedirect() {
  try {
    const response = await fetch(`${process.env.REACT_APP_STRIPE_SERVICE}/stripe/checkout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
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
    const response = await fetch(`${process.env.REACT_APP_STRIPE_SERVICE}/stripe/onboard`, {
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
    console.log(data)
    if (data.onboarding_url) {
    window.location.href = data.onboarding_url;}

  } catch (error) {
    console.error("Error creating checkout:", error);
    alert("There was a problem creating the checkout. Please try again.");
  }
}

export async function postClaimOrder(claimedOrder: ClaimOrder) {
  try {
    const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/claims/claim_order`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(claimedOrder),
    });

    if (!response.ok) {
        const errorDetails = await response.json();
        console.error("Failed to update claimed order:", errorDetails);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

} catch (error) {
    console.error("Error claiming order", error);
    throw error;
}
}

export async function registerWithEmail(username: string, email: string, password: string) {
  const response = await fetch(`${process.env.REACT_APP_AUTH_SERVICE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function loginWithEmail(email: string, password: string) {
  const response = await fetch(`${process.env.REACT_APP_AUTH_SERVICE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function patchClaimQuantity(claimId: string, quantity: number) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/claims/${claimId}/quantity`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function patchClaimStatus(claimId: string, status: string, reason?: string) {
  try {
    const body: Record<string, string> = { status };
    if (reason) body.reason = reason;

    const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/claims/${claimId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorDetails = await response.json();
        console.error("Failed to update claim status:", errorDetails);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating claim status", error);
    throw error;
  }
}

export async function uploadClaimEvidence(claimId: string, imageData: string, description?: string) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/claims/${claimId}/evidence`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_data: imageData, description }),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function fetchClaimEvidence(claimId: string) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/claims/${claimId}/evidence`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchClaimHistory(claimId: string) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/claims/${claimId}/history`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchDispute(claimId: string) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/disputes/${claimId}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

export async function submitDisputeResponse(disputeId: string, responseText: string) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/disputes/${disputeId}/respond`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_text: responseText }),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function resolveDispute(disputeId: string, resolution: string, partialAmountCents?: number) {
  const body: Record<string, any> = { resolution };
  if (partialAmountCents !== undefined) body.partial_amount_cents = partialAmountCents;

  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/disputes/${disputeId}/resolve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function fetchOrderDetail(orderId: string) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/orders/${orderId}/detail`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

export async function toggleOrderVisibility(orderId: string) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/orders/${orderId}/visibility`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function uploadDisputeEvidence(disputeId: string, imageData: string, description?: string) {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/disputes/${disputeId}/evidence`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_data: imageData, description }),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function createShippingLabel(claimId: string): Promise<{
  label_url: string;
  tracking_number: string;
  carrier_code: string;
}> {
  const response = await fetch(`${process.env.REACT_APP_STRIPE_SERVICE}/shipping/create_label/${claimId}`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export async function updateFulfillerAddress(userId: string, address: FulfillerAddress): Promise<void> {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/users/${userId}/fulfiller_address`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(address),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
}

export async function cancelClaim(claimId: string) {
  return patchClaimStatus(claimId, 'cancelled')
}

export async function getFulfillerAddress(userId: string): Promise<FulfillerAddress | null> {
  const response = await fetch(`${process.env.REACT_APP_DB_SERVICE}/users/${userId}/fulfiller_address`, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

export const startRefineTask = async (
    previewTaskId: string, userId: string, portId: string,
    options?: { enable_pbr?: boolean; texture_prompt?: string; remove_lighting?: boolean }
) => {
    const payload: MeshyRefinePayload = {
        mode: 'refine',
        preview_task_id: previewTaskId,
        ...options,
    };
    const response = await fetch(`${process.env.REACT_APP_MESHY_SERVICE}/start_refine_task/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port_id: portId, user_id: userId, meshy_refine_payload: payload }),
    });
    if (!response.ok) throw new Error(`Refine failed: ${response.statusText}`);
    return response.json();
};

