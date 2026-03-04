const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const getAppMode = () => {
  try {
    const envPath = path.join(__dirname, '../../../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/APP_MODE=(.+)/);
      if (match) {
        return match[1].trim();
      }
    }
  } catch (e) {
    // Ignore
  }
  return 'development';
};

module.exports = {
  prompt: async ({ prompter, args }) => {
    const appMode = getAppMode();
    const isDevelopment = appMode === 'development';

    // Force custom in client mode
    const forceCustom = !isDevelopment;

    // Check CLI argument first, then prompt
    let destination = args.destination || 'custom';

    // If client mode, force custom
    if (forceCustom) {
      destination = 'custom';
    }

    // Only prompt in development mode
    if (isDevelopment && !args.destination) {
      const result = await prompter.prompt({
        type: 'select',
        name: 'destination',
        message: 'Where to generate?',
        choices: [
          { message: 'custom (cliente)', value: 'custom' },
          { message: 'modules (plantilla)', value: 'modules' },
        ],
        initial: 0,
      });
      destination = result.destination;
    }

    // If generating in modules, also copy to extensions as template
    if (destination === 'modules') {
      console.log('\n📦 Generando en modules (desarrollo de plantilla)...');

      // Generate first in modules
      const moduleArgs = { ...args, destination: 'modules' };

      // Then copy as extension template
      try {
        execSync(
          `npx hygen generate extension-resource ${args.name || ''}`.trim(),
          { stdio: 'inherit' },
        );
      } catch (e) {
        // Ignore if extension generation fails
      }
    }

    return {
      ...args,
      destination,
    };
  },
};
