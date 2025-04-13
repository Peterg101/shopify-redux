import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { useGetSessionQuery } from "../services/authApi"; // adjust path if needed
import { calculateTotalBasketValue } from "../app/utility/utils";
import { RootState } from "../app/store";
import { setTotalBasketCost } from "../services/userInterfaceSlice";

export const useSyncTotalBasketCost = () => {
  const dispatch = useDispatch();

  // Subscribe to the getSession query which contains basket_items
  const { data: sessionData } = useGetSessionQuery(undefined);
  const basketItems = sessionData?.basket_items || [];
    
  useEffect(() => {
    console.log("Recalculating total basket cost!!!");
    const basketTotal = calculateTotalBasketValue(basketItems);
    dispatch(setTotalBasketCost({ totalBasketCost: basketTotal }));
  }, [basketItems, dispatch]);
};