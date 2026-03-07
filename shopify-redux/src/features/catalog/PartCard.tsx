import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Box,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { Part } from "../../app/utility/interfaces";

interface Props {
  part: Part;
  onClick: (partId: string) => void;
}

const FILE_TYPE_COLORS: Record<string, "primary" | "secondary" | "warning"> = {
  stl: "primary",
  obj: "secondary",
  step: "warning",
};

export const PartCard = ({ part, onClick }: Props) => {
  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 3, height: "100%", display: "flex" }}
    >
      <CardActionArea
        onClick={() => onClick(part.id)}
        sx={{ display: "flex", flexDirection: "column", alignItems: "stretch", height: "100%" }}
      >
        {/* Thumbnail placeholder */}
        <Box
          sx={{
            height: 140,
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {part.thumbnail_url ? (
            <Box
              component="img"
              src={part.thumbnail_url}
              alt={part.name}
              sx={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
            />
          ) : (
            <Typography variant="h4" color="text.disabled">
              3D
            </Typography>
          )}
        </Box>

        <CardContent sx={{ flexGrow: 1, py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Typography variant="subtitle2" noWrap fontWeight={600}>
            {part.name}
          </Typography>

          {part.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {part.description}
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
            <Chip
              label={part.file_type.toUpperCase()}
              size="small"
              color={FILE_TYPE_COLORS[part.file_type] ?? "default"}
              variant="outlined"
            />
            {part.recommended_process && (
              <Chip
                label={part.recommended_process}
                size="small"
                variant="outlined"
              />
            )}
            {part.category && (
              <Chip label={part.category} size="small" variant="outlined" />
            )}
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mt: 1,
              color: "text.secondary",
            }}
          >
            <DownloadIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">{part.download_count}</Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
