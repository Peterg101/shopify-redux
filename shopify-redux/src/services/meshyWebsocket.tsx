import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

export const websocketApi = createApi({
  reducerPath: 'websocketApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    connectToWebSocket: builder.query({
      queryFn: () => ({ data: null }),  // No HTTP request, so just return a placeholder.
      async onCacheEntryAdded(
        arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        // Open a WebSocket connection
        const ws = new WebSocket("ws://localhost:1234/ws");

        try {
          await cacheDataLoaded;

          // Handle incoming WebSocket messages
          ws.onmessage = (event) => {
            const message = event.data;
            console.log(message)
            // Update the cache data with the received WebSocket message
            // updateCachedData((draft) => {
            //   if (!draft.messages) draft.messages = [];
            //     draft.messages.push(message);
            // });
          };

          // Handle WebSocket errors if needed
          ws.onerror = (error) => {
            console.error("WebSocket error:", error);
          };

          // Optionally, send a message to the server
          ws.onopen = () => {
            ws.send("Hello Server!");
          };

          // Wait until the cache entry is removed to close the WebSocket
          await cacheEntryRemoved;
          ws.close();
        } catch {
          ws.close();
        }
      },
    }),
  }),
});

// Export the hook for use in components
export const { useConnectToWebSocketQuery } = websocketApi;
