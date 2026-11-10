FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    INVENTORY_DATA_DIR=/var/lib/backend_data
WORKDIR /app

RUN useradd --system --no-create-home labstock \
    && install -d -o labstock -g labstock /var/lib/backend_data

COPY app.py .
USER labstock
EXPOSE 5000
CMD ["python", "app.py"]
