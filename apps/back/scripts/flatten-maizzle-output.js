/**
 * Script to flatten the Maizzle output directory structure
 * Moves all .hbs files from nested directories to the root of the build directory
 * and deletes the original nested directory structure
 */

const fs = require('fs');
const path = require('path');

// Define source/build directories
const buildDir = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'communications',
  'mail',
  'mail-templates',
  'build',
);
const nestedSourceDir = path.join(buildDir, 'src'); // The src directory inside build

// Create assets directory if it doesn't exist
const assetsDir = path.join(buildDir, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Helper function to delete a directory recursively
function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recurse
        deleteFolderRecursive(curPath);
      } else {
        // Delete file
        fs.unlinkSync(curPath);
      }
    });
    // Delete the empty directory
    fs.rmdirSync(folderPath);
  }
}

// Process all files in the nested directory structure
function processDirectory(directoryPath) {
  // Read all files in the directory
  const items = fs.readdirSync(directoryPath, { withFileTypes: true });

  items.forEach((item) => {
    const fullPath = path.join(directoryPath, item.name);

    if (item.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(fullPath);
    } else if (item.isFile() && item.name.endsWith('.hbs')) {
      // Move .hbs files to the root of the build directory
      const targetPath = path.join(buildDir, item.name);
      fs.copyFileSync(fullPath, targetPath);
      console.log(`Moved: ${item.name} to build directory root`);
    } else if (item.isFile() && !item.name.endsWith('.hbs')) {
      // Move other files (like images) to the assets directory
      const targetPath = path.join(assetsDir, item.name);
      fs.copyFileSync(fullPath, targetPath);
      console.log(`Moved: ${item.name} to assets directory`);
    }
  });
}

// Start processing from the nested source directory
if (fs.existsSync(nestedSourceDir)) {
  console.log('Flattening Maizzle output directory structure...');

  // Find all email templates in the nested structure
  processDirectory(nestedSourceDir);

  // Delete the original nested directory structure
  console.log('Cleaning up nested directory structure...');
  deleteFolderRecursive(nestedSourceDir);

  console.log('Done! Files have been moved and nested directories cleaned up.');
} else {
  console.error(`Directory not found: ${nestedSourceDir}`);
  console.error('Make sure to run maizzle build first');
}
