export function calculateDefaultOverlayPlacement(input) {
  void input;
  return {
    x: 0,
    y: 0,
    scale: 1,
  };
}

export function getOverlayRenderMetrics({
  photoWidth,
  photoHeight,
  videoWidth,
  videoHeight,
  placement,
}) {
  const photoAspectRatio = photoHeight / photoWidth;
  const videoAspectRatio = videoHeight / videoWidth;
  const scale = placement?.scale ?? 1;

  return {
    width: scale,
    height: scale * (videoAspectRatio / photoAspectRatio),
    x: placement?.x ?? 0,
    y: placement?.y ?? 0,
  };
}
