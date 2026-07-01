import { handleReview } from "../lib/handlers/review.js";
import { blobsReviewStore } from "../lib/review-store.js";

const token = process.env.ROADMAP_ADMIN_TOKEN ?? "";

export default async (req: Request) =>
  handleReview(req, {
    store: blobsReviewStore(),
    token,
  });
