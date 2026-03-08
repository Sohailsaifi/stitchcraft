from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import export, import_

app = FastAPI(
    title="StitchCraft API",
    version="0.1.0",
    description="Backend API for StitchCraft embroidery digitizing tool",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(import_.router, prefix="/api/import", tags=["import"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
