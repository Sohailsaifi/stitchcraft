import { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { useDesignStore } from "@/store/designStore";

const MM = 0.1; // 1 mm = 0.1 three.js units
// Per-type radii: fill/satin need half the row-spacing to appear solid (~0.4mm spacing → r=0.020)
const THREAD_R: Record<string, number> = {
  run:       0.012,  // visible outline thread
  satin:     0.020,  // half the satin density spacing
  fill:      0.022,  // half the fill row spacing — makes area look solid
  lettering: 0.012,
  default:   0.012,
};
const THREAD_Y = 0.010;
const MAX_PTS_PER_SEG = 120;

// ── Procedural woven fabric texture ─────────────────────────────────────────
function createFabricTexture(): THREE.CanvasTexture {
  const sz = 512;
  const cv = document.createElement("canvas");
  cv.width = sz; cv.height = sz;
  const ctx = cv.getContext("2d")!;

  // Linen base
  ctx.fillStyle = "#e8e2d6";
  ctx.fillRect(0, 0, sz, sz);

  const sp = 14; // thread spacing px — larger = more visible weave

  // Warp threads (horizontal) — darker, prominent
  for (let y = 0; y < sz; y += sp) {
    const r = 130 + Math.floor(Math.random() * 18);
    ctx.strokeStyle = `rgba(${r - 8},${r - 16},${r - 26},0.6)`;
    ctx.lineWidth = sp * 0.58;
    ctx.beginPath();
    ctx.moveTo(0, y + sp * 0.5);
    ctx.lineTo(sz, y + sp * 0.5);
    ctx.stroke();
  }
  // Weft threads (vertical) — lighter, interleaving
  for (let x = 0; x < sz; x += sp) {
    const r = 155 + Math.floor(Math.random() * 14);
    ctx.strokeStyle = `rgba(${r},${r - 8},${r - 18},0.45)`;
    ctx.lineWidth = sp * 0.48;
    ctx.beginPath();
    ctx.moveTo(x + sp * 0.5, 0);
    ctx.lineTo(x + sp * 0.5, sz);
    ctx.stroke();
  }
  // Over/under intersection highlights
  for (let y = 0; y < sz; y += sp * 2) {
    for (let x = 0; x < sz; x += sp * 2) {
      ctx.fillStyle = "rgba(255,248,238,0.22)";
      ctx.fillRect(x + 1, y + 1, sp - 2, sp - 2);
    }
  }
  for (let y = sp; y < sz; y += sp * 2) {
    for (let x = sp; x < sz; x += sp * 2) {
      ctx.fillStyle = "rgba(255,248,238,0.22)";
      ctx.fillRect(x + 1, y + 1, sp - 2, sp - 2);
    }
  }
  // Shadow at intersections
  for (let y = 0; y < sz; y += sp) {
    for (let x = 0; x < sz; x += sp) {
      ctx.fillStyle = "rgba(60,50,35,0.13)";
      ctx.fillRect(x, y, 3, 3);
    }
  }
  // Subtle noise grain
  for (let i = 0; i < 2000; i++) {
    const a = Math.random() * 0.06;
    ctx.fillStyle = `rgba(80,68,50,${a})`;
    ctx.fillRect(Math.random() * sz, Math.random() * sz, 1, 1);
  }

  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);  // fewer repeats = weave pattern clearly visible
  return t;
}

// ── Thread twist bump texture ────────────────────────────────────────────────
// Creates a diagonal stripe pattern that simulates twisted/plied thread fibers
let _threadBump: THREE.CanvasTexture | null = null;
function getThreadBumpTexture(): THREE.CanvasTexture {
  if (_threadBump) return _threadBump;
  const w = 256, h = 32;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  // Draw helical diagonal stripes
  const pitch = 12;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const phase = ((x * 0.4 + y) % pitch) / pitch;
      const v = Math.round((Math.sin(phase * Math.PI * 2) * 0.5 + 0.5) * 210 + 22);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 1); // 30 twists along tube length
  _threadBump = t;
  return t;
}

// ── Thread material ──────────────────────────────────────────────────────────
function makeThreadMaterial(hex: string): THREE.MeshPhysicalMaterial {
  const base = new THREE.Color(hex);
  const bump = getThreadBumpTexture();
  return new THREE.MeshPhysicalMaterial({
    color: base.clone().lerp(new THREE.Color(0xffffff), 0.08),
    roughness: 0.5,
    metalness: 0.0,
    sheen: 1.0,
    sheenColor: base.clone().lerp(new THREE.Color(0xffffff), 0.5),
    sheenRoughness: 0.25,
    bumpMap: bump,
    bumpScale: 0.6,
  });
}

// ── Component ────────────────────────────────────────────────────────────────
export function StitchPreview3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const orbitRef = useRef({ theta: 0.35, phi: 0.72, radius: 14, dragging: false, lastX: 0, lastY: 0 });
  const threadGroupRef = useRef<THREE.Group | null>(null);

  const { design } = useDesignStore();
  const [expanded, setExpanded] = useState(false);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded]);

  const updateCamera = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi, radius } = orbitRef.current;
    cam.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta)
    );
    cam.lookAt(0, 0, 0);
  }, []);

  // ── Initialize scene ─────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1d2e);
    scene.fog = new THREE.Fog(0x1c1d2e, 25, 55);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.05, 150);
    cameraRef.current = camera;

    // ── Lighting (3-point setup) ───────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xfff5e8, 0.65));

    const key = new THREE.DirectionalLight(0xfff8f0, 2.2);
    key.position.set(6, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    key.shadow.bias = -0.0003;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd0e0ff, 0.6);
    fill.position.set(-5, 4, -3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.35);
    rim.position.set(0, -3, -8);
    scene.add(rim);

    // ── Fabric ─────────────────────────────────────────────────────────────
    const hoopW = design.hoop.width * MM;
    const hoopH = design.hoop.height * MM;
    const fabricTex = createFabricTexture();

    // Fabric mesh — subdivided so it looks soft and catches light variation
    const fabricGeo = new THREE.PlaneGeometry(hoopW * 1.25, hoopH * 1.25, 4, 4);
    const fabricMat = new THREE.MeshStandardMaterial({
      map: fabricTex,
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const fabric = new THREE.Mesh(fabricGeo, fabricMat);
    fabric.rotation.x = -Math.PI / 2;
    fabric.receiveShadow = true;
    scene.add(fabric);

    // Hoop frame ring
    const hoopRingGeo = new THREE.TorusGeometry(
      Math.max(hoopW, hoopH) * 0.63,
      0.06,
      12,
      80
    );
    const hoopRingMat = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.6,
      metalness: 0.3,
    });
    const hoopRing = new THREE.Mesh(hoopRingGeo, hoopRingMat);
    hoopRing.rotation.x = -Math.PI / 2;
    hoopRing.position.y = 0.01;
    scene.add(hoopRing);

    // Thread group
    const threadGroup = new THREE.Group();
    scene.add(threadGroup);
    threadGroupRef.current = threadGroup;

    // Animate
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      updateCamera();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(frameRef.current);
      fabricTex.dispose();
      fabricGeo.dispose();
      fabricMat.dispose();
      hoopRingGeo.dispose();
      hoopRingMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild thread geometry on design change ─────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    const group = threadGroupRef.current;
    if (!scene || !group) return;

    // Dispose old meshes
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        (child.material as THREE.Material)?.dispose();
      }
      child.geometry?.dispose();
      group.remove(child);
    }

    if (design.objects.length === 0) return;

    // Compute bounding box for centering + auto-fit camera radius
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const obj of design.objects) {
      for (const s of obj.generatedStitches) {
        if (s.type === "normal") {
          if (s.x < minX) minX = s.x;
          if (s.x > maxX) maxX = s.x;
          if (s.y < minZ) minZ = s.y;
          if (s.y > maxZ) maxZ = s.y;
        }
      }
    }
    const cx = isFinite(minX) ? ((minX + maxX) / 2) * MM : 0;
    const cz = isFinite(minZ) ? ((minZ + maxZ) / 2) * MM : 0;
    // Set camera radius to fit design with padding
    if (isFinite(minX)) {
      const spanX = (maxX - minX) * MM;
      const spanZ = (maxZ - minZ) * MM;
      const span = Math.max(spanX, spanZ, 1);
      orbitRef.current.radius = span * 1.6;
    }

    for (const obj of design.objects) {
      if (!obj.visible || obj.generatedStitches.length < 2) continue;

      const thread = design.threads.find((t) => t.id === obj.threadId);
      const color = thread?.color ?? "#888888";
      const mat = makeThreadMaterial(color);
      const radius = THREAD_R[obj.type] ?? THREAD_R.default;

      // For fill objects, compute median stitch distance so we can detect
      // row-to-row connections (they're much longer than intra-row stitches
      // because the fill generator emits them as "normal" with no jump tag).
      let splitThreshold = Infinity;
      if (obj.type === "fill" || obj.type === "lettering") {
        const dists: number[] = [];
        const ss = obj.generatedStitches;
        for (let i = 1; i < ss.length; i++) {
          const a = ss[i - 1]!, b = ss[i]!;
          if (a.type === "normal" && b.type === "normal") {
            const dx = b.x - a.x, dy = b.y - a.y;
            dists.push(Math.sqrt(dx * dx + dy * dy));
          }
        }
        if (dists.length > 0) {
          dists.sort((a, b) => a - b);
          const median = dists[Math.floor(dists.length / 2)]!;
          splitThreshold = median * 3.0; // gaps > 3× median = row connection
        }
      }

      // Split into contiguous normal-stitch segments
      const segments: THREE.Vector3[][] = [];
      let cur: THREE.Vector3[] = [];
      let prevNormal: { x: number; y: number } | null = null;

      for (const s of obj.generatedStitches) {
        if (s.type === "jump" || s.type === "trim") {
          if (cur.length >= 2) segments.push(cur);
          cur = [];
          prevNormal = null;
        } else {
          // Break on over-long inter-row connections
          if (prevNormal !== null) {
            const dx = s.x - prevNormal.x, dy = s.y - prevNormal.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > splitThreshold) {
              if (cur.length >= 2) segments.push(cur);
              cur = [];
            }
          }
          cur.push(new THREE.Vector3(
            s.x * MM - cx,
            THREAD_Y,
            s.y * MM - cz
          ));
          prevNormal = { x: s.x, y: s.y };
        }
      }
      if (cur.length >= 2) segments.push(cur);

      for (const seg of segments) {
        if (seg.length < 2) continue;

        // Downsample long segments, preserving shape
        let pts = seg;
        if (seg.length > MAX_PTS_PER_SEG) {
          const step = seg.length / MAX_PTS_PER_SEG;
          pts = Array.from({ length: MAX_PTS_PER_SEG }, (_, i) => seg[Math.round(i * step)]!);
          if (pts[pts.length - 1] !== seg[seg.length - 1]) pts.push(seg[seg.length - 1]!);
        }

        if (pts.length < 2) continue;

        try {
          const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
          const tubeSegs = Math.min(pts.length * 3, 200);
          const geo = new THREE.TubeGeometry(curve, tubeSegs, radius, 10, false);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        } catch {
          // skip degenerate segments
        }
      }
    }
  }, [design]);

  // ── Orbit controls ───────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    orbitRef.current.dragging = true;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!orbitRef.current.dragging) return;
    const dx = e.clientX - orbitRef.current.lastX;
    const dy = e.clientY - orbitRef.current.lastY;
    orbitRef.current.theta -= dx * 0.008;
    orbitRef.current.phi = Math.max(0.08, Math.min(Math.PI * 0.48, orbitRef.current.phi + dy * 0.008));
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
  }, []);

  const handleMouseUp = useCallback(() => { orbitRef.current.dragging = false; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    orbitRef.current.radius = Math.max(2, Math.min(40, orbitRef.current.radius + e.deltaY * 0.015));
  }, []);

  const hasStitches = design.objects.some((o) => o.generatedStitches.length > 0);

  const wrapperStyle: React.CSSProperties = expanded
    ? { position: "fixed", inset: 0, zIndex: 600, background: "#1c1d2e" }
    : { position: "relative", width: "100%", height: "100%", background: "#1c1d2e" };

  return (
    <div style={wrapperStyle}>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {!hasStitches && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            No stitches to preview
          </p>
        </div>
      )}

      {/* Expand / collapse button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Exit fullscreen (Esc)" : "Expand to fullscreen"}
        style={{
          position: "absolute", top: 8, right: 8,
          width: 28, height: 28, borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.45)",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
          transition: "background 0.12s, color 0.12s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)";
          (e.currentTarget as HTMLElement).style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.45)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
        }}
      >
        {expanded ? (
          // Collapse icon
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M1 5h4V1M9 1v4h4M13 9h-4v4M5 13V9H1" />
          </svg>
        ) : (
          // Expand icon
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
          </svg>
        )}
      </button>

      <div className="absolute bottom-2 left-3" style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>
        Drag · Scroll to zoom{expanded ? " · Esc to exit" : ""}
      </div>
    </div>
  );
}
