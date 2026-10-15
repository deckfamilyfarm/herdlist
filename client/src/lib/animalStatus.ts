import type { AnimalStatus } from "@shared/schema";

export const animalStatusLabels: Record<AnimalStatus, string> = {
  active: "Active",
  slaughtered: "Slaughtered",
  sold: "Sold",
  expired: "Died—natural causes",
};
