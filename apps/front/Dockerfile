ARG NODE_VERSION=22.15.0

# Create build stage
FROM node:${NODE_VERSION}-slim AS build

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Set shamefully-hoist to true for better dependency resolution
RUN pnpm config set shamefully-hoist true

# Set the working directory inside the container
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies - pnpm will create a new lockfile
RUN pnpm install

# Copy the rest of the application files to the working directory
COPY . ./

# Generate static files (SPA) - should use less memory than build
RUN pnpm run generate

# Production stage - use simple Node.js static server
FROM node:${NODE_VERSION}-slim

# Install serve
RUN npm install -g serve

# Set the working directory inside the container
WORKDIR /app

# Copy the generated static files from build stage
COPY --from=build /app/dist ./

# Expose the port the application will run on
EXPOSE 3000

# Start static server
CMD ["serve", "-s", ".", "-l", "3000"]
