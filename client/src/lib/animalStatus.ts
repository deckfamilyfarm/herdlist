import type { AnimalStatus } from "@shared/schema";

export const animalStatusLabels: Record<AnimalStatus, string> = {
  active: "Active",
  inactive: "Inactive — disposition unknown",
  slaughtered: "Slaughtered",
  sold: "Sold",
  expired: "Died—natural causes",
};
