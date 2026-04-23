import { BuildStep, StepExecutionResult } from "../app/utility/interfaces";
import logger from "../app/utility/logger";

const GENERATION_URL = process.env.REACT_APP_GENERATION_URL || 'http://localhost:1234';
const MEDIA_URL = process.env.REACT_APP_MEDIA_URL || 'http://localhost:1235';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function generateBuildPlan(
  taskId: string,
  userId: string,
  specText: string,
  process: string,
  material: string,
): Promise<{ steps: BuildStep[] }> {
  const response = await fetch(`${GENERATION_URL}/cad/chat/plan`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      user_id: userId,
      spec_text: specText,
      process,
      material,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to generate build plan: ${detail}`);
  }
  return response.json();
}

export async function generateStep(
  taskId: string,
  userId: string,
  existingScript: string,
  stepDescription: string,
  stepNumber: number,
  process: string,
  timeout?: number,
): Promise<StepExecutionResult> {
  const response = await fetch(`${GENERATION_URL}/cad/chat/step`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      user_id: userId,
      existing_script: existingScript,
      step_description: stepDescription,
      step_number: stepNumber,
      process,
      timeout_seconds: timeout,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to generate step: ${detail}`);
  }
  return response.json();
}

export async function executeCode(
  taskId: string,
  userId: string,
  code: string,
  timeout?: number,
): Promise<StepExecutionResult> {
  const response = await fetch(`${GENERATION_URL}/execute`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      task_id: taskId,
      user_id: userId,
      timeout_seconds: timeout,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to execute code: ${detail}`);
  }
  return response.json();
}

export async function saveStepScript(
  taskId: string,
  script: string,
  prompt: string,
  stepDescription: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/tasks/${taskId}/script`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cadquery_script: script,
      generation_prompt: prompt,
      instruction: stepDescription,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to save step script: ${detail}`);
  }
}

export async function fetchPreviewUrl(jobId: string): Promise<{ url: string }> {
  const response = await fetch(`${MEDIA_URL}/step/${jobId}/preview_url`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch preview URL: ${detail}`);
  }
  return response.json();
}
