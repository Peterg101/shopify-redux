import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../app/store";
import { dataSlice, setTotalCost } from "../services/dataSlice";
import { recalculateTotalCost } from "../app/utility/utils";

export const useSyncTotalCost = () => {
  const dispatch = useDispatch();
  const { modelVolume, materialCost, multiplierValue, totalCost } = useSelector((state: RootState) => state.dataState);

  useEffect(() => {
    console.log("Recalculating cost!!!!")
    const newTotal = recalculateTotalCost({ modelVolume, materialCost, multiplierValue })
    dispatch(setTotalCost({ totalCost: newTotal }));
  }, [modelVolume, materialCost, multiplierValue, totalCost, dispatch]);
};