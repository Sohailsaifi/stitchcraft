import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useDesignStore } from "@/store/designStore";

const MM_TO_UNIT = 0.1; // 1mm = 0.1 three.js units
const THREAD_RADIUS = 0.025;
const FABRIC_Z = -0.01;
const THREAD_Z = 0.02;

export function StitchPreview3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const orbitRef = useRef({ theta: 0.4, phi: 0.9, radius: 15, dragging: false, lastX: 0, lastY: 0 });
  const threadGroupRef = useRef<THREE.Group | null>(null);

  const { design } = useDesignStore();

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x1a1b26);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
    cameraRef.current = camera;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, -3, -5);
    scene.add(fillLight);

    // Fabric plane
    const hoopW = design.hoop.width * MM_TO_UNIT;
    const hoopH = design.hoop.height * MM_TO_UNIT;
    const fabricGeo = new THREE.PlaneGeometry(hoopW, hoopH);
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 1.0, side: THREE.DoubleSide });
    const fabric = new THREE.Mesh(fabricGeo, fabricMat);
    fabric.rotation.x = -Math.PI / 2;
    fabric.position.y = FABRIC_Z;
    scene.add(fabric);

    // Fabric border
    const borderGeo = new THREE.EdgesGeometry(fabricGeo);
    const borderMat = new THREE.LineBasicMaterial({ color: 0xcccccc, opacity: 0.4, transparent: true });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.y = FABRIC_Z + 0.001;
    scene.add(border);

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

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!container) return;
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
      renderer.dispose();
      container.removeChild(renderer.domElement);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update camera position from orbit state
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

  // Rebuild thread geometry when design changes
  useEffect(() => {
    const scene = sceneRef.current;
    const group = threadGroupRef.current;
    if (!scene || !group) return;

    // Clear old threads
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose();
      group.remove(child);
    }

    if (design.objects.length === 0) return;

    for (const obj of design.objects) {
      if (!obj.visible || obj.generatedStitches.length === 0) continue;

      const thread = design.threads.find((t) => t.id === obj.threadId);
      const color = thread?.color ?? "#888888";

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.8,
        metalness: 0.0,
      });

      // Split stitches into segments (break on jumps)
      const segments: Array<Array<{ x: number; y: number }>> = [];
      let currentSeg: Array<{ x: number; y: number }> = [];

      for (const s of obj.generatedStitches) {
        if (s.type === "jump" || s.type === "trim") {
          if (currentSeg.length >= 2) segments.push(currentSeg);
          currentSeg = [];
        } else {
          currentSeg.push({ x: s.x, y: s.y });
        }
      }
      if (currentSeg.length >= 2) segments.push(currentSeg);

      for (const seg of segments) {
        if (seg.length < 2) continue;

        // Limit tube segments for performance
        const pts = seg.length > 20
          ? seg.filter((_, i) => i === 0 || i === seg.length - 1 || i % Math.ceil(seg.length / 20) === 0)
          : seg;

        const v3pts = pts.map((p) => new THREE.Vector3(
          p.x * MM_TO_UNIT,
          THREAD_Z,
          p.y * MM_TO_UNIT  // canvas Y → three.js Z
        ));

        try {
          const curve = new THREE.CatmullRomCurve3(v3pts);
          const tubeGeo = new THREE.TubeGeometry(curve, Math.min(pts.length * 2, 64), THREAD_RADIUS, 4, false);
          const mesh = new THREE.Mesh(tubeGeo, mat);
          group.add(mesh);
        } catch {
          // Skip invalid segments
        }
      }
    }
  }, [design]);

  // Orbit controls
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    orbitRef.current.dragging = true;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!orbitRef.current.dragging) return;
    const dx = e.clientX - orbitRef.current.lastX;
    const dy = e.clientY - orbitRef.current.lastY;
    orbitRef.current.theta -= dx * 0.01;
    orbitRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbitRef.current.phi + dy * 0.01));
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
  }, []);

  const handleMouseUp = useCallback(() => {
    orbitRef.current.dragging = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    orbitRef.current.radius = Math.max(2, Math.min(50, orbitRef.current.radius + e.deltaY * 0.02));
  }, []);

  const hasStitches = design.objects.some((o) => o.generatedStitches.length > 0);

  return (
    <div className="relative w-full h-full" style={{ background: "#1a1b26" }}>
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
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            No stitches to preview
          </p>
        </div>
      )}
      <div
        className="absolute bottom-2 right-3 text-[10px]"
        style={{ color: "rgba(255,255,255,0.2)" }}
      >
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}
