# Stage 1: Build React app
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .

# CRA bakes env vars at build time — pass as build args
ARG REACT_APP_DB_SERVICE
ARG REACT_APP_AUTH_SERVICE
ARG REACT_APP_MESHY_SERVICE
ARG REACT_APP_GENERATION_SERVICE
ARG REACT_APP_STRIPE_SERVICE
ARG REACT_APP_CAD_SERVICE
ARG REACT_APP_STEP_SERVICE
ARG REACT_APP_MOCK_GENERATION

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
