# Use Node.js as base image since we need both Node.js and Python
FROM node:22-bullseye-slim

RUN ls

# Install Python and other system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install specific pnpm version
RUN npm install -g pnpm@9.15.3

# Install dependencies and build the monorepo
RUN pnpm install

# Install uv and Python dependencies
FROM python:3.11-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install Python and other system dependencies
RUN apt-get update && apt-get install -y git

# Expose the port Streamlit runs on
EXPOSE 8501

WORKDIR /app

# Command to run the application
CMD ["uv", "run", "server.py"]
# Infinite loop to keep container running
