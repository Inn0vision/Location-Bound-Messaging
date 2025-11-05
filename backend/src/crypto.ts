/**
 * Crypto utilities using TweetNaCl and Web Crypto API
 * 
 * This module provides simple, explainable cryptographic primitives:
 * - X25519: Elliptic-curve Diffie-Hellman key exchange
 * - Ed25519: Digital signatures for attestation
 * - AES-GCM: Authenticated encryption for message payloads
 * - HKDF: Key derivation to bind keys to location/time
 * - HMAC-SHA256: Message integrity and simple token signing
 */

import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import { createHmac, randomBytes, createHash } from 'crypto';

// ============================================================================
// X25519 - Diffie-Hellman Key Exchange
// ============================================================================

/**
 * Generate an ephemeral X25519 key pair for key exchange
 * Used to establish shared secrets between sender and recipient
 */
export function generateX25519KeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: util.encodeBase64(keyPair.publicKey),
    privateKey: util.encodeBase64(keyPair.secretKey),
  };
}

/**
 * Compute shared secret using X25519
 * Both parties can compute the same shared secret from their private key and peer's public key
 */
export function computeSharedSecret(
  myPrivateKey: string,
  theirPublicKey: string
): string {
  const mySecretKey = util.decodeBase64(myPrivateKey);
  const theirPubKey = util.decodeBase64(theirPublicKey);
  
  // NaCl box uses X25519 for key agreement
  const sharedSecret = nacl.box.before(theirPubKey, mySecretKey);
  return util.encodeBase64(sharedSecret);
}

// ============================================================================
// Ed25519 - Digital Signatures
// ============================================================================

/**
 * Generate Ed25519 signing key pair for device identity
 * Used to sign location attestations
 */
export function generateEd25519KeyPair() {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: util.encodeBase64(keyPair.publicKey),
    privateKey: util.encodeBase64(keyPair.secretKey),
  };
}

/**
 * Sign a message with Ed25519 private key
 * Returns detached signature (signature separate from message)
 */
export function signMessage(message: string, privateKey: string): string {
  const msgBytes = util.decodeUTF8(message);
  const secretKey = util.decodeBase64(privateKey);
  
  const signature = nacl.sign.detached(msgBytes, secretKey);
  return util.encodeBase64(signature);
}

/**
 * Verify Ed25519 signature
 * Returns true if signature is valid for message and public key
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  const msgBytes = util.decodeUTF8(message);
  const sigBytes = util.decodeBase64(signature);
  const pubKey = util.decodeBase64(publicKey);
  
  return nacl.sign.detached.verify(msgBytes, sigBytes, pubKey);
}

// ============================================================================
// HKDF - HMAC-based Key Derivation Function
// ============================================================================

/**
 * HKDF-Extract: Derive a pseudorandom key from input keying material
 */
function hkdfExtract(salt: Buffer, ikm: Buffer): Buffer {
  return createHmac('sha256', salt).update(ikm).digest();
}

/**
 * HKDF-Expand: Expand a pseudorandom key into output keying material
 */
function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const hashLen = 32; // SHA-256 output length
  const n = Math.ceil(length / hashLen);
  
  if (n > 255) {
    throw new Error('HKDF output length too large');
  }
  
  let t = Buffer.alloc(0);
  let okm = Buffer.alloc(0);
  
  for (let i = 1; i <= n; i++) {
    const hmac = createHmac('sha256', prk);
    hmac.update(t);
    hmac.update(info);
    hmac.update(Buffer.from([i]));
    t = hmac.digest();
    okm = Buffer.concat([okm, t]);
  }
  
  return okm.slice(0, length);
}

/**
 * Full HKDF implementation (RFC 5869)
 * Derives a key from input keying material, salt, and context info
 * 
 * This is the magic that binds keys to location/time:
 * We derive K_loc_input from shared_secret + encode(lat, lon, radius, time_window)
 */
export function hkdf(
  ikm: Buffer | string,
  salt: Buffer | string,
  info: Buffer | string,
  length: number = 32
): Buffer {
  const ikmBuf = typeof ikm === 'string' ? Buffer.from(ikm, 'base64') : ikm;
  const saltBuf = typeof salt === 'string' ? Buffer.from(salt) : salt;
  const infoBuf = typeof info === 'string' ? Buffer.from(info) : info;
  
  const prk = hkdfExtract(saltBuf, ikmBuf);
  return hkdfExpand(prk, infoBuf, length);
}

/**
 * Derive location-bound key from shared secret and location parameters
 * This creates a key that is cryptographically tied to specific coordinates and time
 */
export function deriveLocationBoundKey(
  sharedSecret: string,
  lat: number,
  lon: number,
  radiusMeters: number,
  windowStart: number,
  windowEnd: number,
  nonce: string
): Buffer {
  // Encode location parameters into context info
  const locationInfo = JSON.stringify({
    lat: lat.toFixed(6), // 6 decimal places ~ 0.1m precision
    lon: lon.toFixed(6),
    radius: radiusMeters,
    start: windowStart,
    end: windowEnd,
    nonce,
  });
  
  // Use shared secret as input keying material
  // Use fixed salt (could be message-specific for extra randomness)
  // Use location parameters as context info
  return hkdf(
    sharedSecret,
    'LocationBoundMessaging-v1',
    locationInfo,
    32 // 256-bit key for AES-GCM
  );
}

// ============================================================================
// AES-GCM - Authenticated Encryption
// ============================================================================

/**
 * Encrypt data with AES-GCM (authenticated encryption)
 * Returns { ciphertext, nonce, authTag } all base64 encoded
 * 
 * CRITICAL: Never reuse nonce with the same key!
 */
export async function aesGcmEncrypt(
  plaintext: string,
  key: Buffer
): Promise<{ ciphertext: string; nonce: string; authTag: string }> {
  const crypto = await import('crypto');
  
  // Generate random 96-bit nonce (recommended for GCM)
  const nonce = crypto.randomBytes(12);
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  
  // Encrypt
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  // Get authentication tag
  const authTag = cipher.getAuthTag().toString('base64');
  
  return {
    ciphertext,
    nonce: nonce.toString('base64'),
    authTag,
  };
}

/**
 * Decrypt data with AES-GCM
 * Throws error if authentication fails (tampered data)
 */
export async function aesGcmDecrypt(
  ciphertext: string,
  key: Buffer,
  nonce: string,
  authTag: string
): Promise<string> {
  const crypto = await import('crypto');
  
  // Create decipher
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(nonce, 'base64')
  );
  
  // Set auth tag
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  
  // Decrypt
  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}

/**
 * Wrap (encrypt) a key with another key using AES-GCM
 * This is used to wrap the message key K_msg with the location-bound key K_loc_input
 */
export async function wrapKey(
  keyToWrap: Buffer,
  wrappingKey: Buffer
): Promise<{ wrappedKey: string; nonce: string; authTag: string }> {
  const keyBase64 = keyToWrap.toString('base64');
  return aesGcmEncrypt(keyBase64, wrappingKey);
}

/**
 * Unwrap (decrypt) a wrapped key using AES-GCM
 * This is used to unwrap K_msg when the recipient proves they are at the location
 */
export async function unwrapKey(
  wrappedKey: string,
  wrappingKey: Buffer,
  nonce: string,
  authTag: string
): Promise<Buffer> {
  const keyBase64 = await aesGcmDecrypt(wrappedKey, wrappingKey, nonce, authTag);
  return Buffer.from(keyBase64, 'base64');
}

// ============================================================================
// HMAC-SHA256 - Message Authentication
// ============================================================================

/**
 * Compute HMAC-SHA256 for message integrity
 */
export function hmacSha256(message: string, key: string): string {
  const hmac = createHmac('sha256', key);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * Verify HMAC-SHA256
 * Uses constant-time comparison to prevent timing attacks
 */
export function verifyHmac(
  message: string,
  expectedHmac: string,
  key: string
): boolean {
  const computedHmac = hmacSha256(message, key);
  
  // Constant-time comparison
  const expectedBuf = Buffer.from(expectedHmac, 'base64');
  const computedBuf = Buffer.from(computedHmac, 'base64');
  
  if (expectedBuf.length !== computedBuf.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(expectedBuf, computedBuf);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): string {
  return randomBytes(length).toString('base64');
}

/**
 * Generate a random 32-byte key for AES-256-GCM
 */
export function generateAesKey(): Buffer {
  return randomBytes(32);
}

/**
 * Generate a random nonce for use in key derivation
 */
export function generateNonce(): string {
  return generateRandomBytes(16);
}

/**
 * SHA-256 hash for fingerprinting
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('base64');
}
