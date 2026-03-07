import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import { usePublishPartMutation } from "../../services/catalogApi";
import { TaskInformation } from "../../app/utility/interfaces";

interface Props {
  open: boolean;
  onClose: () => void;
  task: TaskInformation;
  fileType: string;
}

const CATEGORIES = [
  "hardware",
  "mechanical",
  "enclosure",
  "structural",
  "decorative",
  "prototype",
  "other",
];

export const PublishPartDialog = ({ open, onClose, task, fileType }: Props) => {
  const [name, setName] = useState(task.task_name || "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [recommendedProcess, setRecommendedProcess] = useState("");
  const [recommendedMaterial, setRecommendedMaterial] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [publishPart, { isLoading }] = usePublishPartMutation();

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setError(null);

    try {
      await publishPart({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        tags: tags.length > 0 ? tags : undefined,
        task_id: task.task_id,
        file_type: fileType,
        recommended_process: recommendedProcess || undefined,
        recommended_material: recommendedMaterial || undefined,
        status: "published",
      }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.detail ?? "Failed to publish part");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Publish to Catalog</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Part Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            size="small"
            fullWidth
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            size="small"
            fullWidth
          />

          <TextField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            select
            size="small"
            fullWidth
          >
            <MenuItem value="">None</MenuItem>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <TextField
              label="Tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              size="small"
              fullWidth
              placeholder="Type and press Enter"
            />
            {tags.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => setTags(tags.filter((t) => t !== tag))}
                  />
                ))}
              </Box>
            )}
          </Box>

          <TextField
            label="Recommended Process"
            value={recommendedProcess}
            onChange={(e) => setRecommendedProcess(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. FDM, SLA, CNC"
          />

          <TextField
            label="Recommended Material"
            value={recommendedMaterial}
            onChange={(e) => setRecommendedMaterial(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. PLA, ABS, Aluminum 6061"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          size="small"
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={18} /> : "Publish"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
