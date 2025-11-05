/**
 * SIMPLIFIED Crypto for Location-Bound Messaging
 * 
 * Easy to explain to faculty:
 * 1. SHA-256 creates a key from location coordinates
 * 2. XOR encryption (simple and visual)
 * 3. Message can ONLY be decrypted at the correct location
 */

import { createHash } from 'crypto';

/**
 * Create encryption key from location coordinates using SHA-256
 * 
 * EXPLAIN TO FACULTY:
 * "We hash the latitude and longitude with SHA-256 to create a unique key.
 *  Only someone at the exact same location can recreate this key."
 */
export function createLocationKey(
  lat: number,
  lon: number,
  radiusMeters: number = 100
): Buffer {
  // Round coordinates based on radius to allow small variations
  // 100m radius = round to 3 decimal places (~111m precision)
  const precision = radiusMeters <= 10 ? 5 : radiusMeters <= 100 ? 3 : 2;
  
  const roundedLat = lat.toFixed(precision);
  const roundedLon = lon.toFixed(precision);
  
  // Create location string
  const locationString = `${roundedLat},${roundedLon}`;
  
  // Hash it with SHA-256 to get a 32-byte key
  const hash = createHash('sha256')
    .update(locationString)
    .digest();
  
  return hash;
}

/**
 * Simple XOR encryption (easy to explain!)
 * 
 * EXPLAIN TO FACULTY:
 * "XOR is like a secret code. We combine the message with the location key.
 *  Without the exact key from the correct location, it's just gibberish."
 */
export function xorEncrypt(message: string, key: Buffer): Buffer {
  const messageBytes = Buffer.from(message, 'utf8');
  const encrypted = Buffer.alloc(messageBytes.length);
  
  for (let i = 0; i < messageBytes.length; i++) {
    // XOR each byte with the key (cycle through key if message is longer)
    encrypted[i] = messageBytes[i] ^ key[i % key.length];
  }
  
  return encrypted;
}

/**
 * XOR decryption (same operation as encryption!)
 * 
 * EXPLAIN TO FACULTY:
 * "XOR has a cool property - encrypting twice gives you back the original.
 *  So decryption is the exact same operation as encryption!"
 */
export function xorDecrypt(encryptedBytes: Buffer, key: Buffer): string {
  const decrypted = Buffer.alloc(encryptedBytes.length);
  
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ key[i % key.length];
  }
  
  return decrypted.toString('utf8');
}

/**
 * Encrypt a message bound to a specific location
 * 
 * SIMPLE DEMO FLOW:
 * 1. Officer 1 enters: "Meet at safehouse" + destination coordinates
 * 2. We create a key from those coordinates using SHA-256
 * 3. We XOR the message with that key
 * 4. Result: encrypted gibberish that only works at that location
 */
export function encryptMessage(
  message: string,
  destLat: number,
  destLon: number,
  radiusMeters: number = 100
): {
  encrypted: string; // base64 encoded
  lat: number;
  lon: number;
  radius: number;
} {
  // Create location-based key
  const locationKey = createLocationKey(destLat, destLon, radiusMeters);
  
  // Encrypt message
  const encrypted = xorEncrypt(message, locationKey);
  
  return {
    encrypted: encrypted.toString('base64'),
    lat: destLat,
    lon: destLon,
    radius: radiusMeters,
  };
}

/**
 * Try to decrypt a message at current location
 * 
 * DEMO FOR FACULTY:
 * - Officer 2 is at location A: tries to decrypt → gets gibberish
 * - Officer 2 moves to correct location: tries again → gets real message!
 */
export function decryptMessage(
  encryptedBase64: string,
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  radiusMeters: number = 100
): {
  success: boolean;
  message?: string;
  distance?: number;
} {
  // Calculate if we're close enough
  const distance = calculateDistance(currentLat, currentLon, targetLat, targetLon);
  
  if (distance > radiusMeters) {
    return {
      success: false,
      distance: Math.round(distance),
    };
  }
  
  // We're at the right location! Create the key and decrypt
  const locationKey = createLocationKey(targetLat, targetLon, radiusMeters);
  const encryptedBytes = Buffer.from(encryptedBase64, 'base64');
  const message = xorDecrypt(encryptedBytes, locationKey);
  
  return {
    success: true,
    message,
    distance: Math.round(distance),
  };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
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
 * Visual demonstration of how location changes the key
 * (Useful for explaining to faculty)
 */
export function demonstrateLocationBinding() {
  const message = "Secret Meeting at 10PM";
  
  console.log("=== LOCATION-BOUND ENCRYPTION DEMO ===\n");
  console.log("Original Message:", message);
  console.log("");
  
  // Location 1: Mumbai
  const mumbai = { lat: 19.0760, lon: 72.8777 };
  const keyMumbai = createLocationKey(mumbai.lat, mumbai.lon);
  console.log("Location 1: Mumbai (19.0760, 72.8777)");
  console.log("SHA-256 Key:", keyMumbai.toString('hex').substring(0, 32) + "...");
  
  const encrypted1 = xorEncrypt(message, keyMumbai);
  console.log("Encrypted:", encrypted1.toString('base64'));
  console.log("");
  
  // Location 2: Delhi (different key!)
  const delhi = { lat: 28.6139, lon: 77.2090 };
  const keyDelhi = createLocationKey(delhi.lat, delhi.lon);
  console.log("Location 2: Delhi (28.6139, 77.2090)");
  console.log("SHA-256 Key:", keyDelhi.toString('hex').substring(0, 32) + "...");
  
  // Try to decrypt Mumbai's message with Delhi's key → GIBBERISH
  const wrongDecrypt = xorDecrypt(encrypted1, keyDelhi);
  console.log("Decrypt with WRONG key:", wrongDecrypt);
  console.log("");
  
  // Decrypt with correct key → SUCCESS
  const correctDecrypt = xorDecrypt(encrypted1, keyMumbai);
  console.log("Decrypt with CORRECT key:", correctDecrypt);
  console.log("\n=== END DEMO ===");
}
