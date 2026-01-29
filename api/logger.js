const logger = {
  info: (data) => {
    if (typeof data === 'object') {
      console.log('[INFO]', JSON.stringify(data, null, 2));
    } else {
      console.log('[INFO]', data);
    }
  },

  warn: (data) => {
    if (typeof data === 'object') {
      console.warn('[WARN]', JSON.stringify(data, null, 2));
    } else {
      console.warn('[WARN]', data);
    }
  },

  error: (data) => {
    if (typeof data === 'object') {
      console.error('[ERROR]', JSON.stringify(data, null, 2));
    } else {
      console.error('[ERROR]', data);
    }
  },

  debug: (data) => {
    if (process.env.NODE_ENV === 'development') {
      if (typeof data === 'object') {
        console.debug('[DEBUG]', JSON.stringify(data, null, 2));
      } else {
        console.debug('[DEBUG]', data);
      }
    }
  },
};

export default logger;
