from fastapi import FastAPI

app = FastAPI(
    title="Voice AI Backend",
    description="Backend API for the Voice AI application",
    version="1.0.0",
)


@app.get("/health")
async def health():
    return {
        "status": "ok"
    }