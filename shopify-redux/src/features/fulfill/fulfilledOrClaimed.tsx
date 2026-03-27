import { Box, Tabs, Tab, Badge, useTheme } from "@mui/material"
import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { FulfillableItems } from "./fulfillableItems";
import { ClaimedItemsOrUpdateClaim } from "./claimedItemsOrUpdateClaim";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { visibleOrders } from "../../app/utility/utils";
import { useGetUserClaimableQuery, useGetUserClaimsQuery } from "../../services/authApi";

export const FulfillOrClaimed = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const theme = useTheme();
  const userInfo = useSelector((state: RootState) => state.userInterfaceState.userInformation);
  const { data: claimableOrders = [] } = useGetUserClaimableQuery();
  const { data: claims = [] } = useGetUserClaimsQuery();

  const claimableCount = userInfo?.user
    ? visibleOrders(userInfo.user, claimableOrders).length
    : 0;
  const claimedCount = claims.length;

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <Box>
      <Tabs
        value={tabIndex}
        onChange={handleChange}
        variant="fullWidth"
        sx={{
          position: "sticky",
          top: 0,
          backgroundColor: "background.paper",
          zIndex: theme.zIndex.appBar - 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Tab
          icon={
            <Badge badgeContent={claimableCount} color="primary" max={99}>
              <AssignmentIcon />
            </Badge>
          }
          iconPosition="start"
          label="Available to Fulfill"
        />
        <Tab
          icon={
            <Badge badgeContent={claimedCount} color="secondary" max={99}>
              <CheckCircleIcon />
            </Badge>
          }
          iconPosition="start"
          label="My Claimed Items"
        />
      </Tabs>

      <Box>
        {tabIndex === 0 && <FulfillableItems />}
        {tabIndex === 1 && <ClaimedItemsOrUpdateClaim />}
      </Box>
    </Box>
  );
};
