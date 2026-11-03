import { PLUGIN_ID } from '../../../shared/src/pluginId';

const getTranslation = (id: string) => `${PLUGIN_ID}.${id}`;
const getPluginId = () => PLUGIN_ID;

export { getTranslation, getPluginId };
