import { useState, useMemo } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  FormGroup,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  useGetManufacturingProcessesQuery,
  useGetManufacturingMaterialsQuery,
  useCreateFulfillerProfileMutation,
  useUpdateFulfillerProfileMutation,
} from "../../services/dbApi";
import {
  FulfillerProfile,
  FulfillerCapabilityCreate,
  ManufacturingProcess,
} from "../../app/utility/interfaces";

const STEPS = [
  "Business Info",
  "Processes",
  "Materials",
  "Equipment",
  "Finishing",
];

const PROCESS_FAMILY_LABELS: Record<string, string> = {
  "3d_printing": "3D Printing",
  cnc: "CNC Machining",
  sheet_metal: "Sheet Metal",
  casting: "Casting",
  injection_molding: "Injection Molding",
};

const COMMON_CERTIFICATIONS = [
  "ISO 9001",
  "ISO 13485",
  "AS9100",
  "ITAR",
  "NADCAP",
];

const COMMON_POST_PROCESSING = [
  "Sanding",
  "Painting",
  "Anodizing",
  "Powder Coating",
  "Polishing",
  "Heat Treatment",
  "Tumbling",
  "Vapor Smoothing",
];

interface Props {
  existingProfile?: FulfillerProfile | null;
  onComplete: () => void;
}

export const FulfillerCapabilityForm = ({
  existingProfile,
  onComplete,
}: Props) => {
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [businessName, setBusinessName] = useState(
    existingProfile?.business_name ?? ""
  );
  const [description, setDescription] = useState(
    existingProfile?.description ?? ""
  );
  const [selectedProcessIds, setSelectedProcessIds] = useState<Set<string>>(
    () =>
      new Set(existingProfile?.capabilities.map((c) => c.process_id) ?? [])
  );
  const [materialsByProcess, setMaterialsByProcess] = useState<
    Record<string, string[]>
  >(() => {
    const map: Record<string, string[]> = {};
    existingProfile?.capabilities.forEach((c) => {
      map[c.process_id] = c.materials ?? [];
    });
    return map;
  });
  const [notesByProcess, setNotesByProcess] = useState<
    Record<string, string>
  >(() => {
    const map: Record<string, string> = {};
    existingProfile?.capabilities.forEach((c) => {
      if (c.notes) map[c.process_id] = c.notes;
    });
    return map;
  });
  const [buildVolumeX, setBuildVolumeX] = useState<string>(
    existingProfile?.max_build_volume_x?.toString() ?? ""
  );
  const [buildVolumeY, setBuildVolumeY] = useState<string>(
    existingProfile?.max_build_volume_y?.toString() ?? ""
  );
  const [buildVolumeZ, setBuildVolumeZ] = useState<string>(
    existingProfile?.max_build_volume_z?.toString() ?? ""
  );
  const [toleranceMm, setToleranceMm] = useState<string>(
    existingProfile?.min_tolerance_mm?.toString() ?? ""
  );
  const [leadTimeMin, setLeadTimeMin] = useState<string>(
    existingProfile?.lead_time_days_min?.toString() ?? ""
  );
  const [leadTimeMax, setLeadTimeMax] = useState<string>(
    existingProfile?.lead_time_days_max?.toString() ?? ""
  );
  const [certifications, setCertifications] = useState<Set<string>>(
    () => new Set(existingProfile?.certifications ?? [])
  );
  const [postProcessing, setPostProcessing] = useState<Set<string>>(
    () => new Set(existingProfile?.post_processing ?? [])
  );

  // RTK Query
  const { data: processes = [], isLoading: processesLoading } =
    useGetManufacturingProcessesQuery();
  const { data: materials = [], isLoading: materialsLoading } =
    useGetManufacturingMaterialsQuery();
  const [createProfile, { isLoading: creating }] =
    useCreateFulfillerProfileMutation();
  const [updateProfile, { isLoading: updating }] =
    useUpdateFulfillerProfileMutation();

  const isEdit = !!existingProfile;
  const isSaving = creating || updating;

  // Group processes by family
  const processesByFamily = useMemo(() => {
    const grouped: Record<string, ManufacturingProcess[]> = {};
    processes.forEach((p) => {
      if (!grouped[p.family]) grouped[p.family] = [];
      grouped[p.family].push(p);
    });
    return grouped;
  }, [processes]);

  // Get materials for selected processes
  const relevantMaterials = useMemo(() => {
    const selectedFamilies = new Set(
      processes
        .filter((p) => selectedProcessIds.has(p.id))
        .map((p) => p.family)
    );
    return materials.filter((m) => selectedFamilies.has(m.process_family));
  }, [materials, processes, selectedProcessIds]);

  // Group relevant materials by process_family
  const materialsByFamily = useMemo(() => {
    const grouped: Record<string, typeof materials> = {};
    relevantMaterials.forEach((m) => {
      if (!grouped[m.process_family]) grouped[m.process_family] = [];
      grouped[m.process_family].push(m);
    });
    return grouped;
  }, [relevantMaterials]);

  const toggleProcess = (processId: string) => {
    setSelectedProcessIds((prev) => {
      const next = new Set(prev);
      if (next.has(processId)) {
        next.delete(processId);
      } else {
        next.add(processId);
      }
      return next;
    });
  };

  const toggleMaterial = (processId: string, materialId: string) => {
    setMaterialsByProcess((prev) => {
      const current = prev[processId] ?? [];
      const next = current.includes(materialId)
        ? current.filter((id) => id !== materialId)
        : [...current, materialId];
      return { ...prev, [processId]: next };
    });
  };

  const toggleSetItem = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    item: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return businessName.trim().length > 0;
      case 1:
        return selectedProcessIds.size > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const capabilities: FulfillerCapabilityCreate[] = Array.from(
      selectedProcessIds
    ).map((processId) => ({
      process_id: processId,
      materials:
        materialsByProcess[processId]?.length > 0
          ? materialsByProcess[processId]
          : undefined,
      notes: notesByProcess[processId] || undefined,
    }));

    const payload = {
      business_name: businessName.trim(),
      description: description.trim() || undefined,
      max_build_volume_x: buildVolumeX ? parseFloat(buildVolumeX) : undefined,
      max_build_volume_y: buildVolumeY ? parseFloat(buildVolumeY) : undefined,
      max_build_volume_z: buildVolumeZ ? parseFloat(buildVolumeZ) : undefined,
      min_tolerance_mm: toleranceMm ? parseFloat(toleranceMm) : undefined,
      lead_time_days_min: leadTimeMin ? parseInt(leadTimeMin) : undefined,
      lead_time_days_max: leadTimeMax ? parseInt(leadTimeMax) : undefined,
      certifications:
        certifications.size > 0 ? Array.from(certifications) : undefined,
      post_processing:
        postProcessing.size > 0 ? Array.from(postProcessing) : undefined,
      capabilities,
    };

    try {
      if (isEdit) {
        await updateProfile(payload).unwrap();
      } else {
        await createProfile(payload).unwrap();
      }
      onComplete();
    } catch (err: any) {
      setError(err?.data?.detail ?? "Failed to save profile");
    }
  };

  if (processesLoading || materialsLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{
          "& .MuiStepLabel-label": { fontSize: "0.65rem", mt: 0.5 },
          "& .MuiStepConnector-root": { top: 12 },
          "& .MuiStep-root": { px: 0.5 },
        }}
      >
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step 0: Business Info */}
      {activeStep === 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
            size="small"
            placeholder="Describe your manufacturing capabilities..."
          />
        </Box>
      )}

      {/* Step 1: Process Selection */}
      {activeStep === 1 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {Object.entries(processesByFamily).map(
            ([family, familyProcesses]) => (
              <Box key={family}>
                <Typography
                  variant="subtitle2"
                  color="primary"
                  sx={{ mb: 0.5 }}
                >
                  {PROCESS_FAMILY_LABELS[family] ?? family}
                </Typography>
                <FormGroup>
                  {familyProcesses.map((proc) => (
                    <FormControlLabel
                      key={proc.id}
                      control={
                        <Checkbox
                          checked={selectedProcessIds.has(proc.id)}
                          onChange={() => toggleProcess(proc.id)}
                          size="small"
                        />
                      }
                      label={proc.display_name}
                    />
                  ))}
                </FormGroup>
              </Box>
            )
          )}
        </Box>
      )}

      {/* Step 2: Material Selection per Process */}
      {activeStep === 2 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {selectedProcessIds.size === 0 ? (
            <Typography color="text.secondary">
              Go back and select at least one process.
            </Typography>
          ) : (
            Object.entries(materialsByFamily).map(
              ([family, familyMaterials]) => {
                const processesInFamily = processes.filter(
                  (p) =>
                    p.family === family && selectedProcessIds.has(p.id)
                );
                return processesInFamily.map((proc) => (
                  <Box key={proc.id}>
                    <Typography
                      variant="subtitle2"
                      color="primary"
                      sx={{ mb: 0.5 }}
                    >
                      {proc.display_name} — Materials
                    </Typography>
                    <Box
                      sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                    >
                      {familyMaterials.map((mat) => (
                        <Chip
                          key={mat.id}
                          label={mat.name}
                          size="small"
                          variant={
                            materialsByProcess[proc.id]?.includes(mat.id)
                              ? "filled"
                              : "outlined"
                          }
                          color={
                            materialsByProcess[proc.id]?.includes(mat.id)
                              ? "primary"
                              : "default"
                          }
                          onClick={() => toggleMaterial(proc.id, mat.id)}
                        />
                      ))}
                    </Box>
                    <TextField
                      label="Notes (optional)"
                      value={notesByProcess[proc.id] ?? ""}
                      onChange={(e) =>
                        setNotesByProcess((prev) => ({
                          ...prev,
                          [proc.id]: e.target.value,
                        }))
                      }
                      size="small"
                      fullWidth
                      sx={{ mt: 1 }}
                      placeholder="e.g. max part size, special capabilities"
                    />
                  </Box>
                ));
              }
            )
          )}
        </Box>
      )}

      {/* Step 3: Equipment Specs */}
      {activeStep === 3 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="subtitle2" color="primary">
            Build Volume (mm)
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              label="X"
              value={buildVolumeX}
              onChange={(e) => setBuildVolumeX(e.target.value)}
              size="small"
              type="number"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Y"
              value={buildVolumeY}
              onChange={(e) => setBuildVolumeY(e.target.value)}
              size="small"
              type="number"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Z"
              value={buildVolumeZ}
              onChange={(e) => setBuildVolumeZ(e.target.value)}
              size="small"
              type="number"
              sx={{ flex: 1 }}
            />
          </Box>
          <TextField
            label="Minimum Tolerance (mm)"
            value={toleranceMm}
            onChange={(e) => setToleranceMm(e.target.value)}
            size="small"
            type="number"
            inputProps={{ step: 0.01 }}
          />
          <Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>
            Lead Time (business days)
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              label="Min"
              value={leadTimeMin}
              onChange={(e) => setLeadTimeMin(e.target.value)}
              size="small"
              type="number"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Max"
              value={leadTimeMax}
              onChange={(e) => setLeadTimeMax(e.target.value)}
              size="small"
              type="number"
              sx={{ flex: 1 }}
            />
          </Box>
        </Box>
      )}

      {/* Step 4: Certifications & Post-Processing */}
      {activeStep === 4 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="subtitle2" color="primary">
            Certifications
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {COMMON_CERTIFICATIONS.map((cert) => (
              <Chip
                key={cert}
                label={cert}
                size="small"
                variant={certifications.has(cert) ? "filled" : "outlined"}
                color={certifications.has(cert) ? "primary" : "default"}
                onClick={() => toggleSetItem(setCertifications, cert)}
              />
            ))}
          </Box>

          <Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>
            Post-Processing Capabilities
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {COMMON_POST_PROCESSING.map((pp) => (
              <Chip
                key={pp}
                label={pp}
                size="small"
                variant={postProcessing.has(pp) ? "filled" : "outlined"}
                color={postProcessing.has(pp) ? "primary" : "default"}
                onClick={() => toggleSetItem(setPostProcessing, pp)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
        <Button
          disabled={activeStep === 0}
          onClick={() => setActiveStep((s) => s - 1)}
          variant="outlined"
          size="small"
        >
          Back
        </Button>
        {activeStep < STEPS.length - 1 ? (
          <Button
            onClick={() => setActiveStep((s) => s + 1)}
            disabled={!canProceed()}
            variant="contained"
            size="small"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !canProceed()}
            variant="contained"
            size="small"
          >
            {isSaving ? (
              <CircularProgress size={18} />
            ) : isEdit ? (
              "Update Profile"
            ) : (
              "Create Profile"
            )}
          </Button>
        )}
      </Box>
    </Box>
  );
};
