# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.13-trixie-slim

# Install the project into `/app`
WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

# Ensure installed tools can be executed out of the box
ENV UV_TOOL_BIN_DIR=/usr/local/bin

COPY apps/hip-3-pusher/uv.lock .
COPY apps/hip-3-pusher/pyproject.toml .

# Install the project's dependencies using the lockfile and settings
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=apps/hip-3-pusher/uv.lock,target=uv.lock \
    --mount=type=bind,source=apps/hip-3-pusher/pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

# Then, add the rest of the project source code and install it
# Installing separately from its dependencies allows optimal layer caching
COPY apps/hip-3-pusher/src/ ./src/
COPY apps/hip-3-pusher/config/ ./config/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# Run the app by default
CMD ["uv", "run", "-m", "pusher.main", "--config", "config/config.toml"]
