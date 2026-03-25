import type { ClientEvents, Entitlement } from "discord.js";
import type { Event } from "../core/typings";
import { env } from "@/env";
import { activatePremium } from "@/modules/fishing/battlepass";
import { info } from "@/utils/logger";

export default {
  name: "entitlementCreate",
  run: async (entitlement: Entitlement) => {
    const skuId = env.BATTLEPASS_SKU_ID;
    if (!skuId) return;

    // Only handle battle pass SKU
    if (entitlement.skuId !== skuId) return;

    const userId = entitlement.userId;
    if (!userId) return;

    info(`Battle Pass purchase: user ${userId} (entitlement ${entitlement.id})`);

    // Activate premium battle pass
    await activatePremium(userId);

    // Consume the entitlement immediately (one-time purchase)
    // This allows re-purchase next season
    try {
      await entitlement.consume();
    } catch {
      // Already consumed or not consumable — fine
    }
  },
} as Event<keyof ClientEvents>;
