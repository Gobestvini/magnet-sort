// The prototype is a singleton. Bootstrap installs its adapter before importing
// it so incoming preview can suspend campaign startup before any save write.
let current = null;
export function setRuntimePlatform(platform) { current = platform; }
export function getRuntimePlatform() { return current; }
export function clearRuntimePlatform(platform) { if (current === platform) current = null; }
