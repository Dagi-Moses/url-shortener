const validUrl = require('valid-url');

// Validates a URL. Returns an error string or null if valid.
 
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return 'target_url is required and must be a string';
  }
  if (!validUrl.isWebUri(url)) {
    return 'target_url must be a valid http or https URL';
  }
  if (url.length > 2048) {
    return 'target_url must not exceed 2048 characters';
  }
  return null;
}



function validateSlug(slug) {
  if (!slug) return null; 
  if (typeof slug !== 'string') return 'slug must be a string';
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(slug)) {
    return 'slug must be 3–20 characters and contain only letters, numbers, hyphens, or underscores';
  }
  return null;
}

/**
 * Validates an expiry date string if provided.
 * Returns the parsed Date, or an error string, or null if not provided.
 */
function validateExpiry(expiresAt) {
  if (!expiresAt) return { date: null, error: null };
  const date = new Date(expiresAt);
  if (isNaN(date.getTime())) {
    return { date: null, error: 'expires_at must be a valid ISO 8601 date string' };
  }
  if (date <= new Date()) {
    return { date: null, error: 'expires_at must be a future date' };
  }
  return { date, error: null };
}

module.exports = { validateUrl, validateSlug, validateExpiry };
