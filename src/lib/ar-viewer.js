export function getViewerMode(projectData) {
  const trackingUrl = projectData?.tracking_url;

  if (typeof trackingUrl === 'string' && trackingUrl.trim().length > 0) {
    return 'tracked';
  }

  return 'manual';
}
