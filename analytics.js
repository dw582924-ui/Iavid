// Vercel Web Analytics initialization for vanilla JavaScript
// Using the inject() method for non-framework projects
import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics
inject({
  mode: 'production' // or 'development' for testing
});
