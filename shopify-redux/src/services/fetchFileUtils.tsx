import { FileInformation, FileResponse, CadGenerationSettings } from "../app/utility/interfaces"
import logger from '../app/utility/logger';
import { safeRedirect } from '../app/utility/urlValidation';

export const fetchFile = async (fileId: string, signal?: AbortSignal): Promise<FileResponse> => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/file_storage/${fileId}`, {
        method: 'GET',
        credentials: 'include',
        signal,
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

/** Fetch a CAD-generated file (glB preview) from media_service by task_id. */
export const fetchCadFile = async (taskId: string, signal?: AbortSignal): Promise<{ file: File; fileUrl: string }> => {
  const previewResp = await fetch(
    `${process.env.REACT_APP_MEDIA_URL}/step/by_task/${taskId}/preview_url`,
    { signal }
  );
  if (!previewResp.ok) {
    throw new Error(`No CAD preview found for task ${taskId}`);
  }

  const { url: presignedUrl } = await previewResp.json();
  const binaryResp = await fetch(presignedUrl, { signal });
  if (!binaryResp.ok) {
    throw new Error(`Failed to fetch CAD preview from storage: ${binaryResp.status}`);
  }

  const blob = await binaryResp.blob();
  const file = new File([blob], `${taskId}.glb`, { type: "model/gltf-binary" });
  const fileUrl = URL.createObjectURL(blob);
  return { file, fileUrl };
};

/** Download the original STEP file (not the GLB preview) from media_service by task_id. */
export const downloadCadStepFile = async (taskId: string, filename: string): Promise<void> => {
  const resp = await fetch(
    `${process.env.REACT_APP_MEDIA_URL}/step/by_task/${taskId}/download_url`,
  );
  if (!resp.ok) {
    throw new Error(`No STEP file found for task ${taskId}`);
  }
  const { url: presignedUrl } = await resp.json();
  const binaryResp = await fetch(presignedUrl);
  if (!binaryResp.ok) {
    throw new Error(`Failed to fetch STEP file: ${binaryResp.status}`);
  }
  const blob = await binaryResp.blob();
  const stepFilename = filename.endsWith('.step') ? filename : `${filename}.step`;
  const a = document.createElement('a');
  const blobUrl = URL.createObjectURL(blob);
  a.href = blobUrl;
  a.download = stepFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
};

const CAD_FILE_TYPES = new Set(['glb', 'step', 'gltf']);

/** Returns true if this file_type is served by media_service (CAD pipeline). */
export const isCadFileType = (fileType: string): boolean => CAD_FILE_TYPES.has(fileType);

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

const MOCK_GENERATION = process.env.REACT_APP_MOCK_GENERATION === 'true';

const startMockGeneration = async (name: string, userId: string, portId: string) => {
  const response = await fetch(`${process.env.REACT_APP_GENERATION_URL}/mock/generate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, user_id: userId, port_id: portId }),
  });
  if (!response.ok) throw new Error(`Mock generation failed: ${response.statusText}`);
  return response.json();
};

export async function createStripeCheckoutAndRedirect(is_collaborative: boolean = false) {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/stripe/checkout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_collaborative }),
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
    const response = await fetch(`${process.env.REACT_APP_API_URL}/stripe/onboard`, {
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

export async function createShippingLabel(claimId: string): Promise<{
  label_url: string;
  tracking_number: string;
  carrier_code: string;
}> {
  const response = await fetch(`${process.env.REACT_APP_API_URL}/shipping/create_label/${claimId}`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    throw new Error(errorDetails.detail || `Error ${response.status}`);
  }
  return await response.json();
}

export const startCadTask = async (
  prompt: string,
  userId: string,
  portId: string,
  settings?: CadGenerationSettings
) => {
  if (MOCK_GENERATION) return startMockGeneration(prompt, userId, portId);

  try {
    const payload = {
      port_id: portId,
      user_id: userId,
      prompt,
      ...(settings && { settings }),
    };

    const response = await fetch(`${process.env.REACT_APP_GENERATION_URL}/start_cad_task/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`CAD task failed: ${response.statusText}`);
    return response.json();
  } catch (error) {
    logger.error("Error starting CAD task:", error);
    throw error;
  }
};
