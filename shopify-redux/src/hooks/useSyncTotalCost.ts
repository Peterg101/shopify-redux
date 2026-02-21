import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../app/store";
import { dataSlice, setTotalCost } from "../services/dataSlice";
import { recalculateTotalCost } from "../app/utility/utils";

export const useSyncTotalCost = () => {
  const dispatch = useDispatch();
  const { modelVolume, materialCost, multiplierValue } = useSelector((state: RootState) => state.dataState);

  useEffect(() => {
    const newTotal = recalculateTotalCost({ modelVolume, materialCost, multiplierValue })
    dispatch(setTotalCost({ totalCost: newTotal }));
  }, [modelVolume, materialCost, multiplierValue, dispatch]);
};