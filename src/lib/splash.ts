// iPhone launch screens (shown by iOS while the installed app opens). Images live in /public/splash
// and are generated from the /app splash screen; one per iPhone screen size.
export const splashDevices = [
  { w: 440, h: 956, r: 3 }, // 16 Pro Max
  { w: 430, h: 932, r: 3 }, // 14/15 Pro Max, 15/16 Plus
  { w: 402, h: 874, r: 3 }, // 16 Pro
  { w: 393, h: 852, r: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 428, h: 926, r: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 390, h: 844, r: 3 }, // 12, 13, 14
  { w: 375, h: 812, r: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, r: 3 }, // XS Max, 11 Pro Max
  { w: 414, h: 896, r: 2 }, // XR, 11
  { w: 375, h: 667, r: 2 }, // SE, 8
];

export const startupImages = splashDevices.map((d) => ({
  url: `/splash/launch-${d.w * d.r}x${d.h * d.r}.jpg`,
  media: `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: portrait)`,
}));
