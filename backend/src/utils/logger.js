'use strict';

const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

const LOGS_DIR = process.env.LOGS_DIR || path.join(__dirname, '../../logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'audit.log'),
      maxsize:  10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...rest }) => {
          const meta = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
          return `${timestamp} [${level}] ${message}${meta}`;
        })
      ),
    }),
  ],
});

module.exports = logger;
