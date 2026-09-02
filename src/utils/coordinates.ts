/**
 * VYOM — Earth Vector Space & Coordinate System Utilities
 *
 * Technical coordinate specification:
 * - Earth Center: (0, 0, 0)
 * - X: East / West axis
 * - Y: North / South axis
 * - Z: Depth axis
 * - Normalized Radius: R = 1
 *
 * Geographic conversion:
 * x = R * cos(latRad) * cos(lngRad)
 * y = R * sin(latRad)
 * z = R * cos(latRad) * sin(lngRad)
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface GeoCoordinate {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm?: number;
}

/**
 * Converts geographic coordinates (latitude, longitude in degrees)
 * to Cartesian vector space coordinates (x, y, z).
 */
export function geographicToCartesian(
  latitudeDeg: number,
  longitudeDeg: number,
  radius: number = 1
): Vector3D {
  const latRad = (latitudeDeg * Math.PI) / 180;
  const lngRad = (longitudeDeg * Math.PI) / 180;

  return {
    x: radius * Math.cos(latRad) * Math.cos(lngRad),
    y: radius * Math.sin(latRad),
    z: radius * Math.cos(latRad) * Math.sin(lngRad),
  };
}

/**
 * Converts Cartesian vector space coordinates (x, y, z)
 * back to geographic coordinates (latitude, longitude in degrees).
 */
export function cartesianToGeographic(
  x: number,
  y: number,
  z: number
): { latitudeDeg: number; longitudeDeg: number; radius: number } {
  const radius = Math.sqrt(x * x + y * y + z * z);
  if (radius === 0) return { latitudeDeg: 0, longitudeDeg: 0, radius: 0 };

  const latRad = Math.asin(Math.max(-1, Math.min(1, y / radius)));
  const lngRad = Math.atan2(z, x);

  return {
    latitudeDeg: (latRad * 180) / Math.PI,
    longitudeDeg: (lngRad * 180) / Math.PI,
    radius,
  };
}
