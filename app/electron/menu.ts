const { Menu } = require('electron');

export const menuList = [
  {
    label: 'Application',
    submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'services' },
        { role: 'quit' },
    ]
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'New Project',
        click: () => {
          console.log('New Project');
        }
      },
      {
        label: 'Open Project',
        click: () => {
          console.log('Open Project');
        }
      },
      {
        label: 'Open Recent',
        submenu: [
          { role: 'clearRecentDocuments' },
          { role: 'recentDocuments' },
        ]
      },
      {
        label: 'Close Project',
        click: () => {
          console.log('Close Project');
        }
      },
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          const { shell } = require('electron');
          await shell.openExternal('https://www.dongguk.edu/');
        }
      }
    ]
  }
];