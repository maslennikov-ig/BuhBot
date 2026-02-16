export default {
  'backend/src/**/*.{ts,tsx}': (files) => {
    const fileArgs = files.join(' ');
    return [
      `bash -c "cd backend && npx eslint --fix ${fileArgs}"`,
      `prettier --write ${fileArgs}`,
    ];
  },
  'frontend/src/**/*.{ts,tsx,js,jsx}': (files) => {
    const fileArgs = files.join(' ');
    return [
      `bash -c "cd frontend && npx eslint --fix ${fileArgs}"`,
      `prettier --write ${fileArgs}`,
    ];
  },
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
