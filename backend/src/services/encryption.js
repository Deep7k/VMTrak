'use strict';

const crypto = require('crypto');

function getKey() {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns { password_enc, password_iv, password_tag } — all base64.
 */
function encryptPassword(plaintext) {
  const iv     = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    password_enc: encrypted.toString('base64'),
    password_iv:  iv.toString('base64'),
    password_tag: cipher.getAuthTag().toString('base64'),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * All params are base64-encoded strings (as stored in DB).
 */
function decryptPassword(password_enc, password_iv, password_tag) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(password_iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(password_tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(password_enc, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encryptPassword, decryptPassword };
