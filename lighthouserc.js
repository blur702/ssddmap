module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3001'],
      startServerCommand: 'npm start',
      startServerReadyPattern: 'Server running on port 3001',
      startServerReadyTimeout: 30000,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', {minScore: 0.7}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['warn', {minScore: 0.8}],
        'categories:seo': ['warn', {minScore: 0.8}],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};