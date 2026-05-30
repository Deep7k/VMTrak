'use strict';

const { db } = require('../db/database');
const logger  = require('../utils/logger');

/**
 * Write a structured audit entry to both the DB and the log file.
 *
 * @param {object} entry
 * @param {number|null} entry.user_id
 * @param {string|null} entry.username
 * @param {string}      entry.action        e.g. 'vm.create'
 * @param {string|null} entry.entity_type   'vm' | 'credential' | 'user' | 'auth'
 * @param {number|null} entry.entity_id
 * @param {string|null} entry.entity_name
 * @param {object|null} entry.detail        changed fields { field: { from, to } }
 * @param {string|null} entry.ip_address
 */
function writeAudit(entry) {
  const {
    user_id     = null,
    username    = null,
    action,
    entity_type = null,
    entity_id   = null,
    entity_name = null,
    detail      = null,
    ip_address  = null,
  } = entry;

  const detailJson = detail ? JSON.stringify(detail) : null;

  db.prepare(`
    INSERT INTO audit_logs
      (user_id, username, action, entity_type, entity_id, entity_name, detail, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user_id, username, action, entity_type, entity_id, entity_name, detailJson, ip_address);

  logger.info(action, {
    user_id,
    username,
    action,
    entity_type,
    entity_id,
    entity_name,
    detail,
    ip_address,
  });
}

/**
 * Extract best-effort client IP from a request.
 */
function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

module.exports = { writeAudit, getIp };
