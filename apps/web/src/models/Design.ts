import type { StitchObject } from "./StitchObject";
import type { Thread } from "./Thread";
import type { Hoop } from "./Hoop";

export interface Design {
  id: string;
  name: string;
  version: number;
  hoop: Hoop;
  threads: Thread[];
  objects: StitchObject[];
  createdAt: number;
  updatedAt: number;
}

export function createDesign(name: string = "Untitled Design"): Design {
  return {
    id: crypto.randomUUID(),
    name,
    version: 1,
    hoop: { width: 100, height: 100, shape: "rectangular" },
    threads: [
      { id: "t1", name: "Black", color: "#000000", brand: "Generic" },
      { id: "t2", name: "White", color: "#FFFFFF", brand: "Generic" },
      { id: "t3", name: "Red", color: "#CC0000", brand: "Generic" },
      { id: "t4", name: "Blue", color: "#0044CC", brand: "Generic" },
      { id: "t5", name: "Green", color: "#008800", brand: "Generic" },
      { id: "t6", name: "Yellow", color: "#DDAA00", brand: "Generic" },
      { id: "t7", name: "Orange", color: "#DD6600", brand: "Generic" },
      { id: "t8", name: "Purple", color: "#6600AA", brand: "Generic" },
    ],
    objects: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
