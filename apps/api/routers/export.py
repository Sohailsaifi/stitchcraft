from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import pyembroidery
import io

router = APIRouter()


class StitchData(BaseModel):
    x: float
    y: float
    type: str  # "normal", "jump", "trim", "stop"


class ExportThread(BaseModel):
    color: str  # hex color
    name: str


class ExportRequest(BaseModel):
    stitches: list[StitchData]
    threads: list[ExportThread]
    format: str  # "dst", "pes", "jef", "exp", "vp3"
    name: str = "design"


FORMAT_MAP = {
    "dst": (".dst", "application/octet-stream"),
    "pes": (".pes", "application/octet-stream"),
    "jef": (".jef", "application/octet-stream"),
    "exp": (".exp", "application/octet-stream"),
    "vp3": (".vp3", "application/octet-stream"),
}


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )


@router.post("/")
async def export_design(req: ExportRequest):
    if req.format not in FORMAT_MAP:
        raise HTTPException(400, f"Unsupported format: {req.format}")

    ext, mime = FORMAT_MAP[req.format]

    pattern = pyembroidery.EmbPattern()

    # Add threads
    for thread in req.threads:
        r, g, b = hex_to_rgb(thread.color)
        t = pyembroidery.EmbThread()
        t.color = pyembroidery.EmbColor(r, g, b)
        t.name = thread.name
        pattern.add_thread(t)

    # Add stitches — pyembroidery uses 1/10 mm units
    for s in req.stitches:
        x_units = s.x * 10  # mm to 1/10 mm
        y_units = s.y * 10

        if s.type == "normal":
            pattern.add_stitch_absolute(pyembroidery.STITCH, x_units, y_units)
        elif s.type == "jump":
            pattern.add_stitch_absolute(pyembroidery.JUMP, x_units, y_units)
        elif s.type == "trim":
            pattern.add_stitch_absolute(pyembroidery.TRIM, x_units, y_units)
        elif s.type == "stop":
            pattern.add_stitch_absolute(pyembroidery.STOP, x_units, y_units)

    pattern.add_stitch_absolute(pyembroidery.END)

    # Write to buffer
    buf = io.BytesIO()
    writer = pyembroidery.get_extension_by_filename(f"design{ext}")
    if not writer:
        raise HTTPException(500, f"No writer found for {ext}")

    pyembroidery.write(pattern, buf, writer)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{req.name}{ext}"'},
    )
