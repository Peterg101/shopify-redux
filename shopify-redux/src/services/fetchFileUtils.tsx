import { FileInformation, FileResponse, MeshyGenerationSettings } from "../app/utility/interfaces"
import {convertFileToDataURI } from "../app/utility/utils";
import { MeshyPayload, MeshyImageTo3DPayload, MeshyRefinePayload } from "../services/meshyApi";
import logger from '../app/utility/logger';
import { safeRedirect } from '../app/utility/urlValidation';

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
      logger.error("Error fetching file:", error);
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
    logger.error("Error starting task:", error);
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
    logger.error("Error starting image-to-3D task:", error);
    throw error;
  }
};


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
    safeRedirect(checkoutUrl);

  } catch (error) {
    logger.error("Error creating checkout:", error);
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
    if (data.onboarding_url) {
    safeRedirect(data.onboarding_url);}

  } catch (error) {
    logger.error("Error creating checkout:", error);
    alert("There was a problem creating the checkout. Please try again.");
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
