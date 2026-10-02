import { app as electronApp, screen } from 'electron';
import { logger } from 'ee-core/log';
import { getConfig } from 'ee-core/config';
import { getMainWindow } from 'ee-core/electron';

class Lifecycle {
  /**
   * core app have been loaded
   */
  async ready(): Promise<void> {
    logger.info('[lifecycle] ready');
  }

  /**
   * electron app ready
   */
  async electronAppReady(): Promise<void> {
    logger.info('[lifecycle] electron-app-ready');

    // When double clicking the icon, display the opened window
    electronApp.on('second-instance', () => {
      const win = getMainWindow();
      if (!win) return;
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    });
  }

  /**
   * main window have been loaded
   */
  async windowReady(): Promise<void> {
    logger.info('[lifecycle] window-ready');

    const win = getMainWindow();
    if (!win) return;

    // 将渲染进程 console 汇入主进程日志，便于排查问题
    (win.webContents as any).on('console-message', (...args: any[]) => {
      try {
        const ev = args[0];
        if (ev && typeof ev === 'object' && 'message' in ev) {
          // Electron >= 32 事件对象风格
          logger.info('[renderer]', String(ev.message));
        } else {
          const [, level, message] = args;
          logger.info('[renderer]', String(message));
        }
      } catch (e) {
        // ignore
      }
    });

    // The window is centered and scaled proportionally
    const mainScreen = screen.getPrimaryDisplay();
    const { width, height } = mainScreen.workAreaSize;
    const windowWidth = Math.min(1280, Math.floor(width * 0.85));
    const windowHeight = Math.min(880, Math.floor(height * 0.85));
    const x = Math.floor((width - windowWidth) / 2);
    const y = Math.floor((height - windowHeight) / 2);
    win.setBounds({ x, y, width: windowWidth, height: windowHeight });

    // Delayed loading, no white screen
    const { windowsOption } = getConfig();
    if (windowsOption.show == false) {
      win.once('ready-to-show', () => {
        win.show();
        win.focus();
      })
    }
  }

  /**
   * before app close
   */
  async beforeClose(): Promise<void> {
    logger.info('[lifecycle] before-close');
  }
}

export {
  Lifecycle
};
