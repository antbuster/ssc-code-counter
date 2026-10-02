import type { Config } from 'ee-core';

/**
 * 开发环境配置，覆盖 config.default
 */
export default (): Partial<Config> => {
  return {
    openDevTools: {
      mode: 'detach'
    }
  };
};
