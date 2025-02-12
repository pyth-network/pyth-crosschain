# Use Node.js as base image since we need both Node.js and Python
FROM node:22-bullseye-slim

# Install Python and other system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install specific pnpm version
RUN npm install -g pnpm@9.15.3

WORKDIR /app

# Copy the entire monorepo
COPY . .

# Install dependencies and build the monorepo
RUN pnpm install

# Install uv and Python dependencies
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN uv pip install --no-cache -r apps/contract-deployer/requirements.txt

# Set working directory to the contract-deployer app
WORKDIR /app/apps/contract-deployer

# Expose the port Streamlit runs on
EXPOSE 8501

# Command to run the application
CMD ["uvx", "streamlit", "run", "server.py", "--server.address", "0.0.0.0"]
