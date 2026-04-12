"""Main CAD generation pipeline -- orchestrates LLM code generation,
sandboxed execution, and STEP file upload."""
import asyncio
import json
import os
import logging
import httpx
from redis.asyncio import Redis as AsyncRedis

from fitd_schemas.fitd_classes import CadTaskRequest
from jwt_auth import generate_token

from cad.llm import generate_cadquery_code, fix_cadquery_code, apply_parameter_changes, refine_cadquery_code
from cad.executor import execute_cadquery
from cad.suppressor import suppress_features, resolve_dependencies
from cad.validator import validate_refinement
from shared import publish, register_task, mark_task_complete, DB_SERVICE_URL

logger = logging.getLogger(__name__)

STEP_SERVICE_URL = os.getenv("STEP_SERVICE_URL", "http://localhost:1235")


async def generate_cad_task(request: CadTaskRequest, redis: AsyncRedis):
    """Main background task: generate CAD model from prompt.

    Progress messages follow the meshy_backend format:
      "{percentage},{task_id},{name}"
      "Task Completed,{task_id},{name},{job_id}"
      "Task Failed,{error_message}"
    """
    port_id = request.port_id
    user_id = request.user_id
    prompt = request.prompt
    rich_context = getattr(request, 'rich_context', None)  # content blocks with images
    settings = request.settings
    max_iterations = settings.max_iterations if settings else 3
    timeout_seconds = settings.timeout_seconds if settings else 30
    target_units = settings.target_units if settings else "mm"
    process = getattr(settings, 'process', 'fdm') if settings else 'fdm'
    approximate_size = getattr(settings, 'approximate_size', None) if settings else None
    material_hint = getattr(settings, 'material_hint', 'plastic') if settings else 'plastic'
    features = getattr(settings, 'features', []) if settings else []

    task_name = prompt[:50].replace(",", " ")
    # Use rich context (with images) if available, otherwise fall back to text prompt
    generation_prompt = rich_context if rich_context else prompt

    try:
        # Step 1: Generate initial code
        await publish(redis, port_id, f"10,generating,{task_name}")
        logger.info(f"[{port_id}] Generating CadQuery code for: {prompt[:80]}")

        code = await generate_cadquery_code(
            generation_prompt, target_units, process, approximate_size, material_hint, features
        )
        await publish(redis, port_id, f"25,generating,{task_name}")

        # Step 2: Execute with retry loop (accumulates fix history for context)
        success = False
        last_error = ""
        attempt = 0
        fix_history: list[tuple[str, str]] = []
        # Capture the build plan from the code generation step for fix context
        # (it's embedded in generate_cadquery_code's internal flow, but we can
        # extract it from the generated code's comments or pass the prompt)
        build_plan = ""  # TODO: surface from generate_cadquery_code if needed

        for attempt in range(max_iterations):
            iter_progress = 25 + int((attempt / max_iterations) * 40)
            status_msg = (
                f"Executing CadQuery (attempt {attempt + 1}/{max_iterations})"
            )
            await publish(redis, port_id, f"{iter_progress},{status_msg},{task_name}")
            logger.info(f"[{port_id}] {status_msg}")

            success, output_path, error, metadata = await asyncio.to_thread(
                execute_cadquery, code, timeout_seconds
            )

            if success:
                if metadata:
                    bb = metadata.get("bbox", {})
                    logger.info(
                        f"[{port_id}] CadQuery succeeded on attempt {attempt + 1}: "
                        f"{bb.get('xlen', 0):.1f}x{bb.get('ylen', 0):.1f}x{bb.get('zlen', 0):.1f}mm, "
                        f"volume={metadata.get('volume_mm3', 0):.1f}mm³"
                    )
                else:
                    logger.info(f"[{port_id}] CadQuery succeeded on attempt {attempt + 1}")
                break

            last_error = error
            logger.warning(
                f"[{port_id}] Attempt {attempt + 1} failed: {error[:200]}"
            )

            # Track this attempt for fix history
            fix_history.append((code, error))

            # Don't retry on last iteration
            if attempt < max_iterations - 1:
                fix_msg = f"Fixing code (attempt {attempt + 2}/{max_iterations})"
                await publish(
                    redis, port_id, f"{iter_progress + 10},{fix_msg},{task_name}"
                )
                code = await fix_cadquery_code(
                    generation_prompt, code, error, target_units,
                    attempt=attempt + 1, max_attempts=max_iterations,
                    process=process, material_hint=material_hint,
                    build_plan=build_plan, fix_history=fix_history,
                )

        if not success:
            error_summary = last_error[:200] if last_error else "Unknown error"
            await publish(
                redis,
                port_id,
                f"Task Failed,Generation failed after {max_iterations} attempts: {error_summary}",
            )
            return

        # Step 3: Register task in api_service (skip if pre-created by chat flow)
        await publish(redis, port_id, f"70,registering,{task_name}")
        if hasattr(request, 'existing_task_id') and request.existing_task_id:
            task_id = request.existing_task_id
            logger.info(f"[{port_id}] Using pre-existing task: {task_id}")
        else:
            task_id = await register_task(
                user_id, task_name, port_id, file_type="step"
            )

        if not task_id:
            await publish(
                redis, port_id, "Task Failed,Could not register task in database"
            )
            return

        # Step 3b: Save the CadQuery script and geometry metadata for parametric editing
        await save_task_script(task_id, code, prompt, metadata)

        # Step 4: Upload STEP file to step_service
        await publish(redis, port_id, f"80,uploading,{task_name}")
        job_id = await upload_step_file(output_path, user_id, task_id)

        if not job_id:
            await publish(
                redis, port_id, "Task Failed,Could not upload STEP file"
            )
            return

        # Step 5: Mark task complete in db_service
        await mark_task_complete(task_id)

        # Step 6: Done -- include job_id so frontend can fetch the glB preview
        await publish(redis, port_id, f"100,complete,{task_name}")
        await publish(
            redis, port_id, f"Task Completed,{task_id},{task_name},{job_id}"
        )
        logger.info(f"[{port_id}] CAD task completed: {task_id}")

    except Exception as e:
        logger.error(f"[{port_id}] CAD task error: {e}", exc_info=True)
        await publish(redis, port_id, f"Task Failed,{str(e)[:200]}")


async def upload_step_file(
    file_path: str, user_id: str, task_id: str
) -> str | None:
    """Upload the generated STEP file to step_service. Returns the job_id on success."""
    try:
        with open(file_path, "rb") as f:
            file_content = f.read()

        auth_token = generate_token("generation_service", audience="media_service")
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{STEP_SERVICE_URL}/step/upload",
                files={
                    "file": (
                        "generated.step",
                        file_content,
                        "application/octet-stream",
                    )
                },
                data={"user_id": user_id, "task_id": task_id},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            if resp.status_code in (200, 201):
                job_id = resp.json().get("job_id")
                logger.info(
                    f"STEP file uploaded successfully for task {task_id}, job_id={job_id}"
                )
                return job_id
            logger.error(f"STEP upload failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"STEP upload error: {e}")
    return None


async def regenerate_cad_task(
    task_id: str, port_id: str, user_id: str,
    parameter_changes: dict, redis: AsyncRedis,
):
    """Regenerate a CAD model with modified parameters."""
    try:
        # Step 1: Fetch stored script
        await publish(redis, port_id, f"10,fetching script,regenerating")
        auth_token = generate_token("generation_service", audience="api_service")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{DB_SERVICE_URL}/tasks/{task_id}/script",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        if resp.status_code != 200 or not resp.json().get("cadquery_script"):
            await publish(redis, port_id, "Task Failed,No stored script found for this task")
            return

        original_script = resp.json()["cadquery_script"]

        # Step 2: Apply parameter changes
        await publish(redis, port_id, f"25,modifying parameters,regenerating")
        modified_script = apply_parameter_changes(original_script, parameter_changes)
        logger.info(f"[{port_id}] Applied {len(parameter_changes)} parameter changes")

        # Step 3: Execute modified script
        await publish(redis, port_id, f"40,executing,regenerating")
        success, output_path, error, metadata = await asyncio.to_thread(
            execute_cadquery, modified_script, 30
        )

        if not success:
            await publish(redis, port_id, f"Task Failed,Regeneration failed: {error[:200]}")
            return

        if metadata:
            bb = metadata.get("bbox", {})
            logger.info(
                f"[{port_id}] Regeneration succeeded: "
                f"{bb.get('xlen', 0):.1f}x{bb.get('ylen', 0):.1f}x{bb.get('zlen', 0):.1f}mm"
            )

        # Step 4: Upload new STEP file (replaces existing for same task_id)
        await publish(redis, port_id, f"70,uploading,regenerating")
        job_id = await upload_step_file(output_path, user_id, task_id)

        if not job_id:
            await publish(redis, port_id, "Task Failed,Could not upload regenerated STEP file")
            return

        # Step 5: Save updated script and geometry metadata
        # Regeneration clears any suppression — full script was executed
        if metadata:
            metadata["suppressed"] = []
        await save_task_script(task_id, modified_script, resp.json().get("generation_prompt", ""), metadata)

        # Step 6: Done
        task_name = "regenerated"
        await publish(redis, port_id, f"100,complete,{task_name}")
        await publish(redis, port_id, f"Task Completed,{task_id},{task_name},{job_id}")
        logger.info(f"[{port_id}] Regeneration completed for task {task_id}")

    except Exception as e:
        logger.error(f"[{port_id}] Regeneration error: {e}", exc_info=True)
        await publish(redis, port_id, f"Task Failed,{str(e)[:200]}")


async def refine_cad_task(
    task_id: str, port_id: str, user_id: str,
    instruction: str, redis: AsyncRedis,
    max_iterations: int = 3, timeout_seconds: int = 30,
):
    """Refine a CAD model using an LLM instruction on the stored script."""
    try:
        # Step 1: Fetch stored script
        await publish(redis, port_id, f"10,fetching script,refining")
        auth_token = generate_token("generation_service", audience="api_service")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{DB_SERVICE_URL}/tasks/{task_id}/script",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        if resp.status_code != 200 or not resp.json().get("cadquery_script"):
            await publish(redis, port_id, "Task Failed,No stored script found for this task")
            return

        script_data = resp.json()
        original_script = script_data["cadquery_script"]
        original_prompt = script_data.get("generation_prompt", "")

        # Parse geometry metadata for spatial context
        geo_json = script_data.get("geometry_metadata")
        geometry_metadata = json.loads(geo_json) if geo_json else None

        # Step 2: Send to LLM for refinement (with geometry context)
        await publish(redis, port_id, f"20,refining with AI,refining")
        logger.info(f"[{port_id}] Refining: {instruction[:80]}")
        refined_script = await refine_cadquery_code(
            original_prompt, original_script, instruction, geometry_metadata
        )
        logger.info(f"[{port_id}] Refined script ({len(refined_script)} chars):\n{refined_script[:500]}")

        # Handle CLARIFICATION responses (LLM needs more info from user)
        if refined_script.strip().startswith("CLARIFICATION:"):
            clarification_msg = refined_script.strip()
            logger.info(f"[{port_id}] LLM requested clarification: {clarification_msg[:100]}")
            await publish(redis, port_id, f"Clarification Needed,{clarification_msg}")
            return

        # Step 3: Execute refined script (with retry)
        success = False
        last_error = ""

        for attempt in range(max_iterations):
            pct = 40 + int((attempt / max_iterations) * 30)
            await publish(redis, port_id, f"{pct},executing (attempt {attempt+1}/{max_iterations}),refining")

            success, output_path, error, metadata = await asyncio.to_thread(
                execute_cadquery, refined_script, timeout_seconds
            )

            if success:
                if metadata:
                    bb = metadata.get("bbox", {})
                    logger.info(
                        f"[{port_id}] Refinement succeeded: "
                        f"{bb.get('xlen', 0):.1f}x{bb.get('ylen', 0):.1f}x{bb.get('zlen', 0):.1f}mm"
                    )
                break

            last_error = error
            logger.warning(f"[{port_id}] Refinement attempt {attempt+1} failed: {error[:200]}")

            if attempt < max_iterations - 1:
                await publish(redis, port_id, f"{pct+10},fixing code,refining")
                refined_script = await fix_cadquery_code(
                    original_prompt, refined_script, error
                )

        if not success:
            await publish(redis, port_id, f"Task Failed,Refinement failed: {last_error[:200]}")
            return

        # Step 3b: Validate refinement before committing
        hard_reject, warnings = validate_refinement(
            original_script, refined_script, instruction,
            geometry_metadata, metadata,
        )
        if hard_reject:
            logger.warning(f"[{port_id}] Refinement REJECTED: {hard_reject}")
            await publish(redis, port_id, f"Refinement Rejected,{hard_reject}")
            return
        if warnings:
            logger.warning(f"[{port_id}] Validation warnings: {warnings}")

        # Step 4: Upload new STEP
        await publish(redis, port_id, f"75,uploading,refining")
        job_id = await upload_step_file(output_path, user_id, task_id)

        if not job_id:
            await publish(redis, port_id, "Task Failed,Could not upload refined STEP file")
            return

        # Step 5: Save updated script and geometry metadata
        # Refinement clears any suppression — full script was executed
        if metadata:
            metadata["suppressed"] = []
        await save_task_script(task_id, refined_script, original_prompt, metadata)

        # Step 6: Done
        task_name = "refined"
        await publish(redis, port_id, f"100,complete,{task_name}")
        await publish(redis, port_id, f"Task Completed,{task_id},{task_name},{job_id}")
        logger.info(f"[{port_id}] Refinement completed for task {task_id}")

    except Exception as e:
        logger.error(f"[{port_id}] Refinement error: {e}", exc_info=True)
        await publish(redis, port_id, f"Task Failed,{str(e)[:200]}")


async def suppress_cad_features(
    task_id: str, port_id: str, user_id: str,
    suppressed_tags: list, redis: AsyncRedis,
):
    """Re-execute a CadQuery script with certain features suppressed."""
    try:
        # Step 1: Fetch stored script + geometry metadata
        await publish(redis, port_id, f"10,fetching script,suppressing")
        auth_token = generate_token("generation_service", audience="api_service")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{DB_SERVICE_URL}/tasks/{task_id}/script",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        if resp.status_code != 200 or not resp.json().get("cadquery_script"):
            await publish(redis, port_id, "Task Failed,No stored script found for this task")
            return

        script_data = resp.json()
        original_script = script_data["cadquery_script"]
        original_prompt = script_data.get("generation_prompt", "")

        # Parse existing features for dependency resolution
        geo_json = script_data.get("geometry_metadata")
        existing_features = []
        if geo_json:
            try:
                geo_data = json.loads(geo_json)
                existing_features = geo_data.get("features", [])
            except (json.JSONDecodeError, TypeError):
                pass

        # Step 2: Resolve dependencies (cascade suppression)
        await publish(redis, port_id, f"20,resolving dependencies,suppressing")
        resolved_tags = resolve_dependencies(existing_features, set(suppressed_tags))
        logger.info(
            f"[{port_id}] Suppressing {len(suppressed_tags)} tags "
            f"(resolved to {len(resolved_tags)} with dependencies): {resolved_tags}"
        )

        # Step 3: Remove suppressed features from script via AST
        await publish(redis, port_id, f"30,modifying script,suppressing")
        modified_script = suppress_features(original_script, resolved_tags)

        # Step 4: Execute modified script
        await publish(redis, port_id, f"50,executing,suppressing")
        success, output_path, error, metadata = await asyncio.to_thread(
            execute_cadquery, modified_script, 30
        )

        if not success:
            await publish(redis, port_id, f"Task Failed,Suppression failed: {error[:200]}")
            return

        if metadata:
            bb = metadata.get("bbox", {})
            logger.info(
                f"[{port_id}] Suppression succeeded: "
                f"{bb.get('xlen', 0):.1f}x{bb.get('ylen', 0):.1f}x{bb.get('zlen', 0):.1f}mm"
            )

        # Step 5: Upload new STEP file
        await publish(redis, port_id, f"75,uploading,suppressing")
        job_id = await upload_step_file(output_path, user_id, task_id)

        if not job_id:
            await publish(redis, port_id, "Task Failed,Could not upload suppressed STEP file")
            return

        # Step 6: Save geometry metadata with suppressed list
        # CRITICAL: Keep the COMPLETE feature list from the original script, not the
        # reduced list from re-execution. Only update faces/edges (they reflect current geometry).
        # The suppressed list tells the frontend which features are currently hidden.
        geo_metadata = {
            "features": existing_features,                    # FULL feature list (preserved)
            "faces": (metadata or {}).get("faces", []),       # from re-execution (current geometry)
            "edges": (metadata or {}).get("edges", []),       # from re-execution (current geometry)
            "suppressed": list(resolved_tags),                # which tags are suppressed
        }
        # Note: we save the ORIGINAL script (not modified) so unsuppression works
        await save_task_script(task_id, original_script, original_prompt, geo_metadata)

        # Step 7: Done
        task_name = "suppressed"
        await publish(redis, port_id, f"100,complete,{task_name}")
        await publish(redis, port_id, f"Task Completed,{task_id},{task_name},{job_id}")
        logger.info(f"[{port_id}] Suppression completed for task {task_id}")

    except Exception as e:
        logger.error(f"[{port_id}] Suppression error: {e}", exc_info=True)
        await publish(redis, port_id, f"Task Failed,{str(e)[:200]}")


async def revert_cad_task(
    task_id: str, port_id: str, user_id: str,
    version: int, redis: AsyncRedis,
):
    """Revert a CAD model to a previous script version by re-executing it."""
    try:
        await publish(redis, port_id, f"10,fetching version {version},reverting")
        auth_token = generate_token("generation_service", audience="api_service")

        # Fetch the versioned script
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{DB_SERVICE_URL}/tasks/{task_id}/versions/{version}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        if resp.status_code != 200:
            await publish(redis, port_id, f"Task Failed,Version {version} not found")
            return

        version_data = resp.json()
        script = version_data["cadquery_script"]
        prompt = version_data.get("generation_prompt", "")

        # Execute the versioned script
        await publish(redis, port_id, f"40,executing,reverting")
        success, output_path, error, metadata = await asyncio.to_thread(
            execute_cadquery, script, 30
        )

        if not success:
            await publish(redis, port_id, f"Task Failed,Revert failed: {error[:200]}")
            return

        # Upload STEP
        await publish(redis, port_id, f"75,uploading,reverting")
        job_id = await upload_step_file(output_path, user_id, task_id)
        if not job_id:
            await publish(redis, port_id, "Task Failed,Could not upload reverted STEP file")
            return

        # Save reverted script as current
        if metadata:
            metadata["suppressed"] = []
        await save_task_script(task_id, script, prompt, metadata)

        task_name = "reverted"
        await publish(redis, port_id, f"100,complete,{task_name}")
        await publish(redis, port_id, f"Task Completed,{task_id},{task_name},{job_id}")
        logger.info(f"[{port_id}] Reverted task {task_id} to version {version}")

    except Exception as e:
        logger.error(f"[{port_id}] Revert error: {e}", exc_info=True)
        await publish(redis, port_id, f"Task Failed,{str(e)[:200]}")


async def save_task_script(
    task_id: str, script: str, prompt: str, geometry_metadata: dict | None = None
):
    """Save the CadQuery script, prompt, and geometry metadata to the task record."""
    try:
        payload: dict = {"cadquery_script": script, "generation_prompt": prompt}
        if geometry_metadata:
            geo_json: dict = {
                "features": geometry_metadata.get("features", []),
                "faces": geometry_metadata.get("faces", []),
                "edges": geometry_metadata.get("edges", []),
            }
            if "suppressed" in geometry_metadata:
                geo_json["suppressed"] = geometry_metadata["suppressed"]
            payload["geometry_metadata"] = json.dumps(geo_json)
        auth_token = generate_token("generation_service", audience="api_service")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                f"{DB_SERVICE_URL}/tasks/{task_id}/script",
                json=payload,
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            if resp.status_code == 200:
                logger.info(f"Script saved for task {task_id}")
            else:
                logger.warning(f"Failed to save script: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.warning(f"Script save error (non-fatal): {e}")
