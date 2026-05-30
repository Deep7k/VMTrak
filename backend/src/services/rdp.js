'use strict';

/**
 * Generate the content of a .rdp file in memory.
 * Password is intentionally excluded — user copies it from the credential panel.
 *
 * @param {string} ipAddress
 * @param {string|null} credUsername
 * @returns {string}
 */
function generateRdpContent(ipAddress, credUsername) {
  const lines = [
    `full address:s:${ipAddress}`,
    credUsername ? `username:s:${credUsername}` : '',
    'prompt for credentials:i:1',
    'administrative session:i:0',
    'desktopwidth:i:1920',
    'desktopheight:i:1080',
    'session bpp:i:32',
    'connection type:i:7',
    'networkautodetect:i:1',
    'bandwidthautodetect:i:1',
    'displayconnectionbar:i:1',
    'enableworkspacereconnect:i:0',
    'disable wallpaper:i:0',
    'autoreconnection enabled:i:1',
    'authentication level:i:2',
  ];

  return lines.filter(Boolean).join('\r\n') + '\r\n';
}

module.exports = { generateRdpContent };
