import { handleProgress } from "../lib/handlers/progress.js";
import { blobsRoadmapStore } from "../lib/roadmap-store.js";
import { allIds } from "../../src/data/roadmap.js";

const token = process.env.ROADMAP_ADMIN_TOKEN ?? "";

export default async (req: Request) =>
  handleProgress(req, {
    store: blobsRoadmapStore(),
    token,
    validIds: allIds,
    clock: () => new Date(),
  });
