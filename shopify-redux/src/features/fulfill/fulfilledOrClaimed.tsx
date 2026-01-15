import { Box, Tabs, Tab, useTheme } from "@mui/material"
import { useState } from "react";
import { FulfillableItems } from "./fulfillableItems";
import { ClaimedItems } from "./claimedItems";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export const FulfillOrClaimed = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const theme = useTheme();

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <Box>
      <Tabs
        value={tabIndex}
        onChange={handleChange}
        centered
        sx={{
          position: "sticky",
          top: theme.mixins.toolbar.minHeight,
          backgroundColor: "background.paper",
          zIndex: theme.zIndex.appBar - 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Tab
          icon={<AssignmentIcon />}
          iconPosition="start"
          label="Available to Fulfill"
        />
        <Tab
          icon={<CheckCircleIcon />}
          iconPosition="start"
          label="My Claimed Items"
        />
      </Tabs>

      <Box>
        {tabIndex === 0 && <FulfillableItems />}
        {tabIndex === 1 && <ClaimedItems />}
      </Box>
    </Box>
  );
};