/**
 * Location Attestation and Verification
 * 
 * This module handles:
 * - Creating signed location attestations (device proves it is at coordinates)
 * - Verifying attestations and checking anti-spoofing measures
 * - Computing distance between coordinates (haversine formula)
 */

import { signMessage, verifySignature } from './crypto.js';

// ============================================================================
// Types
// ============================================================================

export interface LocationAttestation {
  deviceId: string;
  devicePublicKey: string;
  latitude: number;
  longitude: number;
  accuracy: number; // GPS accuracy in meters
  timestamp: number; // Unix timestamp in milliseconds
  altitude?: number;
  heading?: number;
  speed?: number;
  // Anti-spoofing context
  wifiSSIDs?: string[]; // Nearby WiFi networks
  cellTowers?: CellTowerInfo[];
  movementHistory?: LocationPoint[]; // Recent positions for continuity check
  // Signature
  signature: string;
}

export interface CellTowerInfo {
  mcc: string; // Mobile Country Code
  mnc: string; // Mobile Network Code
  lac: string; // Location Area Code
  cellId: string;
  signalStrength?: number;
}

export interface LocationPoint {
  lat: number;
  lon: number;
  timestamp: number;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  attestation?: LocationAttestation;
  distance?: number; // Distance from target in meters
}

// ============================================================================
// Location Attestation Creation
// ============================================================================

/**
 * Create a signed location attestation
 * Device signs its current GPS coordinates with its private key
 */
export function createLocationAttestation(
  deviceId: string,
  devicePrivateKey: string,
  devicePublicKey: string,
  latitude: number,
  longitude: number,
  accuracy: number,
  context?: {
    altitude?: number;
    heading?: number;
    speed?: number;
    wifiSSIDs?: string[];
    cellTowers?: CellTowerInfo[];
    movementHistory?: LocationPoint[];
  }
): LocationAttestation {
  const timestamp = Date.now();
  
  // Build attestation payload
  const attestation: Omit<LocationAttestation, 'signature'> = {
    deviceId,
    devicePublicKey,
    latitude,
    longitude,
    accuracy,
    timestamp,
    ...context,
  };
  
  // Create canonical string to sign
  const message = JSON.stringify({
    deviceId,
    lat: latitude.toFixed(6),
    lon: longitude.toFixed(6),
    accuracy,
    timestamp,
  });
  
  // Sign with device private key
  const signature = signMessage(message, devicePrivateKey);
  
  return {
    ...attestation,
    signature,
  };
}

/**
 * Verify the cryptographic signature of an attestation
 */
export function verifyAttestationSignature(
  attestation: LocationAttestation
): boolean {
  // Reconstruct the signed message
  const message = JSON.stringify({
    deviceId: attestation.deviceId,
    lat: attestation.latitude.toFixed(6),
    lon: attestation.longitude.toFixed(6),
    accuracy: attestation.accuracy,
    timestamp: attestation.timestamp,
  });
  
  // Verify signature
  return verifySignature(
    message,
    attestation.signature,
    attestation.devicePublicKey
  );
}

// ============================================================================
// Distance Calculation (Haversine Formula)
// ============================================================================

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Check if location is within geofence radius
 */
export function isWithinGeofence(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  radiusMeters: number
): { within: boolean; distance: number } {
  const distance = calculateDistance(currentLat, currentLon, targetLat, targetLon);
  return {
    within: distance <= radiusMeters,
    distance,
  };
}

// ============================================================================
// Time Window Verification
// ============================================================================

/**
 * Check if current time is within the allowed window
 */
export function isWithinTimeWindow(
  currentTimestamp: number,
  windowStart: number,
  windowEnd: number
): boolean {
  return currentTimestamp >= windowStart && currentTimestamp <= windowEnd;
}

/**
 * Check if attestation timestamp is fresh (not too old)
 */
export function isAttestationFresh(
  attestationTimestamp: number,
  maxAgeSec: number = 300 // 5 minutes default
): boolean {
  const now = Date.now();
  const ageMs = now - attestationTimestamp;
  return ageMs >= 0 && ageMs <= maxAgeSec * 1000;
}

// ============================================================================
// Anti-Spoofing Checks
// ============================================================================

/**
 * Calculate speed between two positions
 * Returns speed in meters per second
 */
function calculateSpeed(point1: LocationPoint, point2: LocationPoint): number {
  const distance = calculateDistance(point1.lat, point1.lon, point2.lat, point2.lon);
  const timeDelta = (point2.timestamp - point1.timestamp) / 1000; // seconds
  
  if (timeDelta <= 0) return 0;
  return distance / timeDelta;
}

/**
 * Check for impossible movement (teleportation detection)
 * Returns true if movement is physically plausible
 */
export function checkMovementPlausibility(
  movementHistory: LocationPoint[],
  maxSpeedMps: number = 200 // 200 m/s = ~720 km/h (faster than commercial aircraft)
): { plausible: boolean; reason?: string; maxSpeed?: number } {
  if (!movementHistory || movementHistory.length < 2) {
    return { plausible: true };
  }
  
  // Sort by timestamp
  const sorted = [...movementHistory].sort((a, b) => a.timestamp - b.timestamp);
  
  // Check each transition
  let maxSpeed = 0;
  for (let i = 1; i < sorted.length; i++) {
    const speed = calculateSpeed(sorted[i - 1], sorted[i]);
    maxSpeed = Math.max(maxSpeed, speed);
    
    if (speed > maxSpeedMps) {
      return {
        plausible: false,
        reason: `Impossible speed detected: ${speed.toFixed(2)} m/s (max: ${maxSpeedMps} m/s)`,
        maxSpeed,
      };
    }
  }
  
  return { plausible: true, maxSpeed };
}

/**
 * Verify continuous presence at location
 * Checks if device has been at location for required duration
 */
export function verifyContinuousPresence(
  movementHistory: LocationPoint[],
  targetLat: number,
  targetLon: number,
  radiusMeters: number,
  requiredDurationSec: number
): { verified: boolean; reason?: string; duration?: number } {
  if (!movementHistory || movementHistory.length === 0) {
    return {
      verified: false,
      reason: 'No movement history provided',
    };
  }
  
  // Sort by timestamp
  const sorted = [...movementHistory].sort((a, b) => a.timestamp - b.timestamp);
  
  // Find continuous window within geofence
  let windowStart = -1;
  let windowDuration = 0;
  
  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i];
    const { within } = isWithinGeofence(point.lat, point.lon, targetLat, targetLon, radiusMeters);
    
    if (within) {
      if (windowStart === -1) {
        windowStart = point.timestamp;
      }
      windowDuration = point.timestamp - windowStart;
    } else {
      // Reset window if left geofence
      windowStart = -1;
      windowDuration = 0;
    }
  }
  
  const durationSec = windowDuration / 1000;
  
  if (durationSec >= requiredDurationSec) {
    return { verified: true, duration: durationSec };
  }
  
  return {
    verified: false,
    reason: `Insufficient continuous presence: ${durationSec.toFixed(1)}s (required: ${requiredDurationSec}s)`,
    duration: durationSec,
  };
}

// ============================================================================
// Full Attestation Verification
// ============================================================================

export interface VerificationConfig {
  targetLat: number;
  targetLon: number;
  radiusMeters: number;
  windowStart: number;
  windowEnd: number;
  maxAttestationAgeSec?: number;
  requireContinuousPresence?: boolean;
  continuousPresenceDurationSec?: number;
  maxSpeedMps?: number;
}

/**
 * Verify a location attestation with full anti-spoofing checks
 * This is the main entry point for verification
 */
export function verifyLocationAttestation(
  attestation: LocationAttestation,
  config: VerificationConfig
): VerificationResult {
  // 1. Verify cryptographic signature
  if (!verifyAttestationSignature(attestation)) {
    return {
      valid: false,
      reason: 'Invalid signature - attestation has been tampered with',
    };
  }
  
  // 2. Check timestamp freshness
  const maxAge = config.maxAttestationAgeSec ?? 300;
  if (!isAttestationFresh(attestation.timestamp, maxAge)) {
    return {
      valid: false,
      reason: `Attestation too old (max age: ${maxAge}s)`,
      attestation,
    };
  }
  
  // 3. Check time window
  if (!isWithinTimeWindow(attestation.timestamp, config.windowStart, config.windowEnd)) {
    return {
      valid: false,
      reason: 'Attestation timestamp outside allowed time window',
      attestation,
    };
  }
  
  // 4. Check geofence
  const { within, distance } = isWithinGeofence(
    attestation.latitude,
    attestation.longitude,
    config.targetLat,
    config.targetLon,
    config.radiusMeters
  );
  
  if (!within) {
    return {
      valid: false,
      reason: `Location outside geofence: ${distance.toFixed(2)}m from target (max: ${config.radiusMeters}m)`,
      attestation,
      distance,
    };
  }
  
  // 5. Check movement plausibility (anti-teleportation)
  if (attestation.movementHistory && attestation.movementHistory.length >= 2) {
    const maxSpeed = config.maxSpeedMps ?? 200;
    const plausibility = checkMovementPlausibility(attestation.movementHistory, maxSpeed);
    
    if (!plausibility.plausible) {
      return {
        valid: false,
        reason: plausibility.reason,
        attestation,
        distance,
      };
    }
  }
  
  // 6. Check continuous presence (optional)
  if (config.requireContinuousPresence && attestation.movementHistory) {
    const durationSec = config.continuousPresenceDurationSec ?? 30;
    const presence = verifyContinuousPresence(
      attestation.movementHistory,
      config.targetLat,
      config.targetLon,
      config.radiusMeters,
      durationSec
    );
    
    if (!presence.verified) {
      return {
        valid: false,
        reason: presence.reason,
        attestation,
        distance,
      };
    }
  }
  
  // All checks passed!
  return {
    valid: true,
    attestation,
    distance,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lon).toFixed(6)}°${lonDir}`;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(1)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}
