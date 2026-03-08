export interface Point {
  x: number;
  y: number;
}

export interface Stitch {
  x: number;
  y: number;
  type: "normal" | "jump" | "trim" | "stop";
}

export type StitchObjectType = "run" | "satin" | "fill" | "lettering" | "manual";

export interface BaseStitchObject {
  id: string;
  type: StitchObjectType;
  threadId: string;
  visible: boolean;
  locked: boolean;
  points: Point[];
  generatedStitches: Stitch[];
}

export interface RunStitchObject extends BaseStitchObject {
  type: "run";
  stitchLength: number; // mm
  runType: "single" | "triple";
}

export interface SatinColumnObject extends BaseStitchObject {
  type: "satin";
  railLeft: Point[];
  railRight: Point[];
  density: number; // lines per mm
  pullCompensation: number; // mm
  underlayType: "none" | "center_walk" | "zigzag" | "edge_walk";
}

export interface FillRegionObject extends BaseStitchObject {
  type: "fill";
  fillAngle: number; // degrees
  density: number; // row spacing in mm
  maxStitchLength: number; // mm
  stagger: number; // 0-1
  pullCompensation: number; // mm
  underlayType: "none" | "tatami" | "zigzag";
  underlayAngle: number;
}

export type StitchObject = RunStitchObject | SatinColumnObject | FillRegionObject;

export function createRunStitch(threadId: string, points: Point[]): RunStitchObject {
  return {
    id: crypto.randomUUID(),
    type: "run",
    threadId,
    visible: true,
    locked: false,
    points,
    generatedStitches: [],
    stitchLength: 2.5,
    runType: "single",
  };
}

export function createSatinColumn(
  threadId: string,
  railLeft: Point[],
  railRight: Point[]
): SatinColumnObject {
  // Store all points as flat for generic operations (selection bounds, etc.)
  const points = [...railLeft, ...railRight];
  return {
    id: crypto.randomUUID(),
    type: "satin",
    threadId,
    visible: true,
    locked: false,
    points,
    generatedStitches: [],
    railLeft,
    railRight,
    density: 4,
    pullCompensation: 0.2,
    underlayType: "center_walk",
  };
}

export function createFillRegion(threadId: string, points: Point[]): FillRegionObject {
  return {
    id: crypto.randomUUID(),
    type: "fill",
    threadId,
    visible: true,
    locked: false,
    points,
    generatedStitches: [],
    fillAngle: 0,
    density: 0.4,
    maxStitchLength: 7,
    stagger: 0.25,
    pullCompensation: 0.2,
    underlayType: "tatami",
    underlayAngle: 90,
  };
}
