import { createApi } from '@reduxjs/toolkit/query/react';
import { createBaseQueryWithReauth } from './baseQueryWithReauth';
import { BasketQuantityUpdate } from "../app/utility/interfaces";
import { authApi } from './authApi';

export const basketApi = createApi({
  reducerPath: 'basketApi',
  baseQuery: createBaseQueryWithReauth(process.env.REACT_APP_API_URL!),
  endpoints: (builder) => ({
    updateBasketQuantity: builder.mutation<void, BasketQuantityUpdate>({
      query: ({ task_id, quantity }) => ({
        url: `/basket_item_quantity`,
        method: 'POST',
        body: { task_id, quantity },
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      async onQueryStarted({ task_id, quantity }, { dispatch, queryFulfilled }) {
        // Optimistically update the basket item quantity in the RTK Query cache
        const patchResult = dispatch(
          authApi.util.updateQueryData('getUserBasket', undefined, (draft: any) => {
            const item = draft?.find((i: any) => i.task_id === task_id);
            if (item) {
              item.quantity = quantity;
            }
          })
        );

        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['BasketItems']));
        } catch {
          patchResult.undo();
        }
      },
    }),
    generateTasksFromBasket: builder.mutation<{ message: string; task_ids: string[] }, void>({
      query: () => ({
        url: `/tasks/from_basket`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Invalidate authApi's session cache to refetch updated basket/task data
          dispatch(authApi.util.invalidateTags(['BasketItems', 'UserOrders']));
        } catch {
          // Mutation failed — no cache to rollback
        }
      },
    }),
  }),
});

export const { 
  useUpdateBasketQuantityMutation,
  useGenerateTasksFromBasketMutation 
} = basketApi;
