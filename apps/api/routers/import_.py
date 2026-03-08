from fastapi import APIRouter, UploadFile, File
import pyembroidery
import io
import tempfile
import os

router = APIRouter()


@router.post("/")
async def import_design(file: UploadFile = File(...)):
    contents = await file.read()
    filename = file.filename or "design.dst"

    # pyembroidery needs a file path, so write to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        pattern = pyembroidery.read(tmp_path)

        if pattern is None:
            return {"error": "Could not read file"}

        # Extract threads
        threads = []
        for t in pattern.threadlist:
            color = t.color
            threads.append({
                "color": f"#{color.red:02x}{color.green:02x}{color.blue:02x}",
                "name": t.description or t.name or "Thread",
            })

        # Extract stitches
        stitches = []
        for s in pattern.stitches:
            x, y, cmd = s[0], s[1], s[2]
            stitch_type = "normal"
            if cmd == pyembroidery.JUMP:
                stitch_type = "jump"
            elif cmd == pyembroidery.TRIM:
                stitch_type = "trim"
            elif cmd == pyembroidery.STOP:
                stitch_type = "stop"
            elif cmd == pyembroidery.END:
                break

            stitches.append({
                "x": x / 10,  # 1/10 mm to mm
                "y": y / 10,
                "type": stitch_type,
            })

        return {
            "name": os.path.splitext(filename)[0],
            "threads": threads,
            "stitches": stitches,
            "stitchCount": len(stitches),
        }
    finally:
        os.unlink(tmp_path)
