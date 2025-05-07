import { Button, Snackbar, Alert } from "@mui/material"
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import { convertFileToBase64WithoutFileReader, generateUuid } from "../../app/utility/utils";
import { BasketInformationAndFile } from "../../app/utility/interfaces";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { useFile } from '../../services/fileProvider';
import { resetDataState } from "../../services/dataSlice";
import { postFile } from "../../services/fetchFileUtils";
import { authApi } from "../../services/authApi";
import { setLeftDrawerClosed } from "../../services/userInterfaceSlice";
import { useState } from "react";
import { useSyncTotalCost } from "../../hooks/useSyncTotalCost";

export const AddToBasket = () => {
  const dispatch = useDispatch()
  const dataState = useSelector(
    (state: RootState) => state.dataState
  )
  const userState = useSelector(
    (state: RootState) => state.userInterfaceState
  )
  const syncCost = useSyncTotalCost
  const {actualFile} = useFile()

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

const handleCloseSnackbar = () => {
  setSnackbar({ ...snackbar, open: false });
};

const showSnackbar = (message: string, severity: "success" | "error") => {
  setSnackbar({ open: true, message, severity });
};

const handleAddToBasket = async () => {
  if (!dataState.printMaterial || !dataState.printTechnique) {
    showSnackbar("Please select a print material and technique before proceeding.", "error");
    return;
  }

  try {
    const itemUUID = generateUuid();
    if (actualFile) {
      const base64String = await convertFileToBase64WithoutFileReader(actualFile);
      
      const basketInformationAndFile: BasketInformationAndFile = {
        user_id: userState.userInformation?.user.user_id,
        task_id: dataState.taskId ? dataState.taskId : itemUUID,
        name: dataState.fileNameBoxValue,
        material: dataState.printMaterial,
        technique: dataState.printTechnique,
        sizing: dataState.multiplierValue,
        colour: dataState.modelColour,
        selected_file: dataState.selectedFile,
        selectedFileType: dataState.selectedFileType,
        quantity: 1,
        file_blob: base64String,
        price: dataState.totalCost,
      };
      await postFile(basketInformationAndFile);
      dispatch(resetDataState());
      dispatch(authApi.util.invalidateTags([{ type: "sessionData" }]));
      dispatch(setLeftDrawerClosed());

      showSnackbar("Item successfully added to basket!", "success");
    }
  } catch (error) {
    showSnackbar("An error occurred while adding the item.", "error");
  }
};

return (
  <>
    <Button
      component="label"
      role={undefined}
      variant="contained"
      tabIndex={-1}
      onClick={handleAddToBasket}
      sx={{
        border: "1px",
        backgroundColor: "white",
        "&:hover": {
          backgroundColor: "theme-color",
        },
      }}
    >
      <ShoppingBasketIcon sx={{ color: "black" }} />
    </Button>

    <Snackbar
      open={snackbar.open}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      autoHideDuration={3000}
      onClose={handleCloseSnackbar}
    >
      <Alert
        onClose={handleCloseSnackbar}
        severity={snackbar.severity as any}
        sx={{ width: "100%" }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  </>
);
}