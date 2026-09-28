import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outputDirectory = path.join(root, 'dist');
const assetsDirectory = path.join(outputDirectory, 'assets');
const headersPath = path.join(outputDirectory, '_headers');
const generatedMarker =
  '# Cache imutável gerado para assets versionados existentes';
const hashedAssetPattern = /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

function listFiles(directory) {
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

if (!fs.existsSync(headersPath) || !fs.existsSync(assetsDirectory)) {
  throw new Error(
    'O output Pages está incompleto: faltam _headers ou dist/assets.',
  );
}

const assetPaths = listFiles(assetsDirectory)
  .map((filePath) =>
    path.relative(outputDirectory, filePath).replaceAll('\\', '/'),
  )
  .sort();

if (assetPaths.length === 0) {
  throw new Error('O build não produziu assets versionados em dist/assets.');
}

const invalidAssets = assetPaths.filter(
  (assetPath) => !hashedAssetPattern.test(path.posix.basename(assetPath)),
);

if (invalidAssets.length > 0) {
  throw new Error(
    `Assets sem hash recusados pela política de cache: ${invalidAssets.join(', ')}`,
  );
}

const sourceHeaders = fs.readFileSync(headersPath, 'utf8').trimEnd();
if (
  sourceHeaders.includes(generatedMarker) ||
  sourceHeaders.includes('/assets/*')
) {
  throw new Error(
    'A configuração base de headers contém cache de assets genérico.',
  );
}

const generatedRules = assetPaths
  .map(
    (assetPath) =>
      `/${assetPath}\n  Cache-Control: public, max-age=31536000, immutable`,
  )
  .join('\n\n');

fs.writeFileSync(
  headersPath,
  `${sourceHeaders}\n\n${generatedMarker}\n${generatedRules}\n`,
  'utf8',
);

console.info(
  `Headers Pages finalizados para ${assetPaths.length} assets versionados existentes.`,
);
