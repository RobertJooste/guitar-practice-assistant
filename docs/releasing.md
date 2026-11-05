# Publishing a Release

Pushing a version tag runs GitHub Actions to check the project, build desktop packages, and publish them as assets on a GitHub Release.

## Before tagging

1. Update the `Unreleased` section in [CHANGELOG.md](../CHANGELOG.md) with the changes and any data or backup compatibility notes.
2. Set the release version in `package.json` and `package-lock.json`. Use semantic versioning; for example, `0.1.1` for a beta patch or `0.2.0` for a beta feature release.
3. Move the changelog entries into a dated version section.
4. Run the checks locally:

   ```sh
   npm ci
   npm run lint
   npm test -- --run
   npm run build
   ```

5. Commit and push the version and changelog changes to `main`.

## Publish

From the project directory, create and push a matching tag. Replace `0.1.1` with the version in `package.json`:

```sh
git tag -a v0.1.1 -m "0.1.1"
git push origin v0.1.1
```

The workflow rejects a tag that does not match `package.json`. It runs lint, tests, and the build, then creates three macOS ZIP options: Apple Silicon (arm64), Intel (x64), and universal (both architectures). It also creates a Windows x64 portable package and Linux x64 AppImage. Once all package jobs pass, GitHub creates a Release with generated notes and attaches the packages. The release page lists each file's size alongside its download link so users can compare the options.

Follow the run under the repository's **Actions** tab. If a job fails, fix the cause and push a corrected tag only after deleting the failed tag locally and remotely, or use a new version number. Do not overwrite a published version.

These packages are unsigned and macOS packages are not notarized. GitHub Actions builds the artifacts but does not deploy the PWA or sign desktop packages.
