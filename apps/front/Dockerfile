ARG NODE_VERSION=22.15.0

# Create build stage
FROM node:${NODE_VERSION}-slim AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json to the working directory
COPY ./package.json /app/

# Install dependencies (using npm install since the lockfile is at the monorepo root)
RUN npm install --legacy-peer-deps

# Copy the rest of the application files to the working directory
COPY . ./

# Build the application
RUN npm run build

# Create a new stage for the production image
FROM node:${NODE_VERSION}-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the output from the build stage to the working directory
COPY --from=build /app/.output ./

# Expose the port the application will run on
EXPOSE 3000

# Start the application
CMD ["node","/app/server/index.mjs"]
