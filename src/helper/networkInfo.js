import os from "node:os";

export function getPairingNetworkInfo({
  hostHeader = "",
  interfaces = os.networkInterfaces(),
} = {}) {
  const port = parsePort(hostHeader);
  const urls = listIPv4Addresses(interfaces).map((address) => `http://${address}${port ? `:${port}` : ""}`);

  return {
    port: port ? Number(port) : null,
    urls: urls.length > 0 ? urls : fallbackUrls(hostHeader),
  };
}

function parsePort(hostHeader) {
  const lastColon = hostHeader.lastIndexOf(":");
  if (lastColon === -1) {
    return "";
  }
  return hostHeader.slice(lastColon + 1);
}

function listIPv4Addresses(interfaces) {
  return Object.values(interfaces)
    .flat()
    .filter(Boolean)
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

function fallbackUrls(hostHeader) {
  if (!hostHeader) {
    return [];
  }
  return [`http://${hostHeader}`];
}
