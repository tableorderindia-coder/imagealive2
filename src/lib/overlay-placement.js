export const INSET = 0.95;

export function getPhotoSpace(photoWidth, photoHeight) {
  return {
    width: 1,
    height: photoHeight / photoWidth,
  };
}

export function getContainSize(imgW, imgH, vidW, vidH) {
  const imgRatio = imgW / imgH;
  const vidRatio = vidW / vidH;

  if (vidRatio > imgRatio) {
    return {
      width: imgW,
      height: imgW / vidRatio,
    };
  }

  return {
    width: imgH * vidRatio,
    height: imgH,
  };
}

export function getCoverSize(imgW, imgH, vidW, vidH) {
  const imgRatio = imgW / imgH;
  const vidRatio = vidW / vidH;

  if (vidRatio > imgRatio) {
    return {
      width: imgH * vidRatio,
      height: imgH,
    };
  }

  return {
    width: imgW,
    height: imgW / vidRatio,
  };
}

export function calculateDefaultOverlayPlacement(input) {
  void input;
  return {
    x: 0,
    y: 0,
    scale: 1,
  };
}

export function computeOverlayMetrics({
  photoWidth,
  photoHeight,
  videoWidth,
  videoHeight,
  fit = 'cover',
  inset = INSET,
}) {
  const photo = getPhotoSpace(photoWidth, photoHeight);
  const baseSize =
    fit === 'contain'
      ? getContainSize(photo.width, photo.height, videoWidth, videoHeight)
      : getCoverSize(photo.width, photo.height, videoWidth, videoHeight);

  return {
    width: baseSize.width * inset,
    height: baseSize.height * inset,
    photoWidth: photo.width,
    photoHeight: photo.height,
  };
}

export function getOverlayRenderMetrics({
  photoWidth,
  photoHeight,
  videoWidth,
  videoHeight,
  placement,
  fit = 'cover',
  inset = INSET,
}) {
  const metrics = computeOverlayMetrics({
    photoWidth,
    photoHeight,
    videoWidth,
    videoHeight,
    fit,
    inset,
  });

  return {
    width: metrics.width * (placement?.scale ?? 1),
    height: metrics.height * (placement?.scale ?? 1),
    x: placement?.x ?? 0,
    y: placement?.y ?? 0,
    photoWidth: metrics.photoWidth,
    photoHeight: metrics.photoHeight,
  };
}
