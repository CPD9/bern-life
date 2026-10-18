FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY engine/pyproject.toml /tmp/engine/pyproject.toml
COPY engine/src /tmp/engine/src
RUN pip install --no-cache-dir /tmp/engine && rm -rf /tmp/engine

COPY contracts contracts
COPY sources sources

RUN useradd --system --uid 10001 --home-dir /app bernlife && mkdir -p data && chown bernlife data
USER bernlife

ENTRYPOINT ["python", "-m", "bernlife"]
