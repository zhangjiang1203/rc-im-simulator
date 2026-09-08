export const DEFAULT_COMPOSE_RATIO = 0.6;
export const MIN_COMPOSE_WIDTH = 420;
export const MIN_LOG_WIDTH = 440;

export function clampComposeWidth(availableWidth, requestedWidth) {
  const maximumWidth = Math.max(0, availableWidth - MIN_LOG_WIDTH);
  return Math.min(Math.max(requestedWidth, MIN_COMPOSE_WIDTH), maximumWidth);
}

export function getDefaultComposeWidth(availableWidth) {
  return clampComposeWidth(
    availableWidth,
    Math.round(availableWidth * DEFAULT_COMPOSE_RATIO),
  );
}
