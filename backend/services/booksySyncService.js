/**
 * Booksy Gmail sync is currently handled only by the client-side parser.
 * The former server route is kept for compatibility, but it must not report
 * a successful sync until the Hetzner backend has a real Gmail connector.
 */
const booksySync = async () => ({
  success: true,
  configured: false,
  enabled: false,
  failed: [],
  reason: 'booksy_gmail_server_sync_not_connected',
  scheduled: [],
  sent: [],
  skipped: true,
});

module.exports = { booksySync };
