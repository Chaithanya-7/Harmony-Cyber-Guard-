# ML Service Deployment

This service backs the `analyze-call`, `analyze-text`, and `analyze-caller` Supabase functions.

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `POST /analyze/text`
- `POST /analyze/call`
- `POST /analyze/caller`

## Environment Variables

- `PRELOAD_MODELS=false`
- `TEXT_MODEL_ID=answerdotai/ModernBERT-base`
- `AUDIO_MODEL_ID=microsoft/wavlm-base-plus`
- `CALLER_MODEL_PATH=/app/models/caller_risk_model.pkl`
- `LOG_LEVEL=INFO`

## Local Run

```bash
cd backend/ml_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Local Smoke Test

```bash
cd backend/ml_service
python test_api.py
```

## Docker Build

```bash
cd backend/ml_service
docker build -t cyberguard-ml-service .
docker run -p 8000:8000 \
  -e PRELOAD_MODELS=false \
  -e TEXT_MODEL_ID=answerdotai/ModernBERT-base \
  -e AUDIO_MODEL_ID=microsoft/wavlm-base-plus \
  cyberguard-ml-service
```

## Supabase Configuration

In Supabase project settings, add:

- `ML_INFERENCE_URL=https://your-ml-service-host`
- `OPENAI_API_KEY=...` or `LOVABLE_API_KEY=...`

The Edge Functions already fall back if the ML service is unavailable, but production should set `ML_INFERENCE_URL`.

## Trained Model Integration

### Text model

Train and export a checkpoint with:

```python
from train import train_modern_bert
train_modern_bert("your_text_dataset.csv", "./model_output")
```

Then point `TEXT_MODEL_ID` at the exported directory or deployed Hugging Face model.

### Caller model

Train the caller-risk model with:

```python
from train import train_caller_xgboost
train_caller_xgboost("your_caller_dataset.csv", "./caller_risk_model.pkl")
```

Then set:

```bash
CALLER_MODEL_PATH=/app/caller_risk_model.pkl
```

## Production Checklist

1. Deploy the service and confirm `GET /healthz` returns `200`.
2. Confirm `GET /readyz` reports model status.
3. Set `ML_INFERENCE_URL` in Supabase.
4. Redeploy Supabase functions after env updates.
5. Run `python test_api.py` against the deployed URL.
