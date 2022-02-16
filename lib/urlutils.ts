const deliveryDomain = process.env.NEXT_PUBLIC_MUX_BYO_DOMAIN || "mux.com";

export function getStreamBaseUrl() {
  return `https://stream.staging.mux.com`;
}

export function getImageBaseUrl() {
  return `https://image.staging.mux.com`;
}
