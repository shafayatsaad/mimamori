const { detectCriticalKeywords } = require('./lib/critical-alerts');
console.log('detectCriticalKeywords test:', detectCriticalKeywords('Patient has a critical condition requiring immediate attention.'));
