const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    // Only the build output, package.json and the runtime dependencies are shipped;
    // sources, configuration and caches stay out of the app.
    ignore: [
      /^\/(src|electron|shared|public|out)(\/|$)/,
      /^\/node_modules\/\.(cache|tmp|vite)(\/|$)/,
      /^\/(?!package\.json$)[^/]+\.(html|json|ts|js|cjs|md|yaml)$/,
      /^\/\.[^/]+$/,
    ],
    icon: './src/assets/icon',
    executableName: 'UmJoonSIC',
    osxSign: {},
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: './src/assets/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      config: {
        icon: './src/assets/icon.icns',
      },
    },
    // {
    //   name: '@electron-forge/maker-dmg',
    //   config: {
    //     icon: './src/assets/icon.icns',
    //   },
    // },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './src/assets/icon.png',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: './src/assets/icon.png',
        },
      },
    },
  ],
  make_targets: {
    win32: ['squirrel'],
    darwin: ['dmg', 'zip'],
    linux: ['deb', 'rpm', 'zip'],
  },
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
