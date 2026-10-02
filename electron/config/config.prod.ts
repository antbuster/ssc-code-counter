import type { Config } from 'ee-core';

/**
 * 生产环境配置，覆盖 config.default
 */
export default (): Partial<Config> => {
  return {
    openDevTools: false,
  };
};
