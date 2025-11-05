/**
 * Crypto utilities for browser (mirrors backend crypto.ts)
 * Uses Web Crypto API and TweetNaCl
 */

import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';

// ============================================================================
// X25519 - Diffie-Hellman Key Exchange
// ============================================================================

export function generateX25519KeyPair() {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: util.encodeBase64(keyPair.publicKey),
    privateKey: util.encodeBase64(keyPair.secretKey),
  };
}

export function computeSharedSecret(
  myPrivateKey: string,
  theirPublicKey: string
): string {
  const mySecretKey = util.decodeBase64(myPrivateKey);
  const theirPubKey = util.decodeBase64(theirPublicKey);
  const sharedSecret = nacl.box.before(theirPubKey, mySecretKey);
  return util.encodeBase64(sharedSecret);
}

// ============================================================================
// Ed25519 - Digital Signatures
// ============================================================================

export function generateEd25519KeyPair() {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: util.encodeBase64(keyPair.publicKey),
    privateKey: util.encodeBase64(keyPair.secretKey),
  };
}

export function signMessage(message: string, privateKey: string): string {
  const msgBytes = util.decodeUTF8(message);
  const secretKey = util.decodeBase64(privateKey);
  const signature = nacl.sign.detached(msgBytes, secretKey);
  return util.encodeBase64(signature);
}

// ============================================================================
// HKDF - Key Derivation
// ============================================================================

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  return await hmac(salt, ikm);
}

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const hashLen = 32;
  const n = Math.ceil(length / hashLen);
  
  if (n > 255) throw new Error('HKDF output length too large');
  
  let t = new Uint8Array(0);
  let okm = new Uint8Array(0);
  
  for (let i = 1; i <= n; i++) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t);
    input.set(info, t.length);
    input[t.length + info.length] = i;
    
    t = await hmac(prk, input);
    
    const newOkm = new Uint8Array(okm.length + t.length);
    newOkm.set(okm);
    newOkm.set(t, okm.length);
    okm = newOkm;
  }
  
  return okm.slice(0, length);
}

export async function hkdf(
  ikm: Uint8Array | string,
  salt: Uint8Array | string,
  info: Uint8Array | string,
  length: number = 32
): Promise<Uint8Array> {
  const ikmBuf = typeof ikm === 'string' ? util.decodeBase64(ikm) : ikm;
  const saltBuf = typeof salt === 'string' ? new TextEncoder().encode(salt) : salt;
  const infoBuf = typeof info === 'string' ? new TextEncoder().encode(info) : info;
  
  const prk = await hkdfExtract(saltBuf, ikmBuf);
  return await hkdfExpand(prk, infoBuf, length);
}

export async function deriveLocationBoundKey(
  sharedSecret: string,
  lat: number,
  lon: number,
  radiusMeters: number,
  windowStart: number,
  windowEnd: number,
  nonce: string
): Promise<Uint8Array> {
  const locationInfo = JSON.stringify({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    radius: radiusMeters,
    start: windowStart,
    end: windowEnd,
    nonce,
  });
  
  return await hkdf(sharedSecret, 'LocationBoundMessaging-v1', locationInfo, 32);
}

// ============================================================================
// AES-GCM - Authenticated Encryption
// ============================================================================

export async function aesGcmEncrypt(
  plaintext: string,
  key: Uint8Array
): Promise<{ ciphertext: string; nonce: string; authTag: string }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    cryptoKey,
    encodedText
  );
  
  const ciphertextWithTag = new Uint8Array(encrypted);
  const ciphertext = ciphertextWithTag.slice(0, -16);
  const authTag = ciphertextWithTag.slice(-16);
  
  return {
    ciphertext: util.encodeBase64(ciphertext),
    nonce: util.encodeBase64(nonce),
    authTag: util.encodeBase64(authTag),
  };
}

export async function aesGcmDecrypt(
  ciphertext: string,
  key: Uint8Array,
  nonce: string,
  authTag: string
): Promise<string> {
  const ciphertextBytes = util.decodeBase64(ciphertext);
  const nonceBytes = util.decodeBase64(nonce);
  const authTagBytes = util.decodeBase64(authTag);
  
  const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combined.set(ciphertextBytes);
  combined.set(authTagBytes, ciphertextBytes.length);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonceBytes, tagLength: 128 },
    cryptoKey,
    combined
  );
  
  return new TextDecoder().decode(decrypted);
}

export async function wrapKey(
  keyToWrap: Uint8Array,
  wrappingKey: Uint8Array
): Promise<{ wrappedKey: string; nonce: string; authTag: string }> {
  const keyBase64 = util.encodeBase64(keyToWrap);
  return await aesGcmEncrypt(keyBase64, wrappingKey);
}

export async function unwrapKey(
  wrappedKey: string,
  wrappingKey: Uint8Array,
  nonce: string,
  authTag: string
): Promise<Uint8Array> {
  const keyBase64 = await aesGcmDecrypt(wrappedKey, wrappingKey, nonce, authTag);
  return util.decodeBase64(keyBase64);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function generateRandomBytes(length: number): string {
  return util.encodeBase64(crypto.getRandomValues(new Uint8Array(length)));
}

export function generateAesKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function generateNonce(): string {
  return generateRandomBytes(16);
}
