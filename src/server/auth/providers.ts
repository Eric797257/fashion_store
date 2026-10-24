import "server-only";
import { socialProviders } from "@/lib/env";

export interface EnabledProviders {
  google: boolean;
  facebook: boolean;
}

export function getEnabledProviders(): EnabledProviders {
  return { google: socialProviders.google, facebook: socialProviders.facebook };
}